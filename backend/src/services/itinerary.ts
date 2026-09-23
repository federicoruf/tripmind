// services/itinerary.ts
import { GoogleGenAI } from "@google/genai";
import { itinerarySchema } from "../schemas/itinerarySchema";
import { Day } from "../schemas/itinerarySchema.zod";
import {
  logRequestCost,
  GeminiUsage,
  assertBudgetOk,
} from "../utils/costLogger";
import { conReintento } from "../utils/geminiRetry";
import { getMemory } from "../memory";
import { buildSystemInstruction } from "../utils/buildSystemInstruction";
import { buildFinalPrompt } from "./promptBuilder";
import { MAX_OUTPUT_TOKENS_ITINERARY } from "../constans";
import { updateUserMemory } from "./memoryUpdater";
import {
  propagateAttributes,
  startActiveObservation,
  startObservation,
} from "@langfuse/tracing";
import { logStep, logWarn, previewTexto } from "../utils/logger";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Generación NO streaming: usada por el eval, tests, o cualquier consumidor
 * que solo necesite el itinerario final ya armado (sin ir emitiendo por SSE).
 */
export async function generateItinerary(
  prompt: string,
  userId: string,
  options?: {
    // Prompt "limpio" a guardar en memoria de usuario, cuando `prompt`
    // difiere del pedido original (ej: un reintento del orquestador del
    // Paso 10, que le agrega feedback del validador al prompt). Por
    // defecto es el mismo `prompt`, para no romper llamadas existentes.
    promptOriginal?: string;
    // Permite que el orquestador desactive la actualización automática de
    // memoria por intento, y la haga una sola vez al final del grafo (evita
    // llamar al LLM de memoria una vez por cada reintento).
    actualizarMemoria?: boolean;
  },
): Promise<Day[]> {
  const promptOriginal = options?.promptOriginal ?? prompt;
  const actualizarMemoria = options?.actualizarMemoria ?? true;

  logStep("service:itinerary", "Generando itinerario", {
    userId,
    prompt: previewTexto(prompt),
  });

  return startActiveObservation("generate-itinerary", async (trace) => {
    return propagateAttributes({ userId }, async () => {
      trace.update({ input: prompt });

      const augmentedPrompt = await buildFinalPrompt(prompt, trace);
      logStep("service:itinerary", "Prompt aumentado listo (RAG + tools)", {
        chars: augmentedPrompt.length,
      });
      const memoria = await getMemory(userId);

      assertBudgetOk();

      const response = await startActiveObservation(
        "gemini-call",
        async (gen) => {
          const res = await conReintento(() =>
            ai.models.generateContent({
              model: process.env.GEMINI_MODEL!,
              contents: augmentedPrompt,
              config: {
                systemInstruction: buildSystemInstruction(memoria),
                responseMimeType: "application/json",
                responseSchema: itinerarySchema,
                maxOutputTokens: MAX_OUTPUT_TOKENS_ITINERARY,
              },
            }),
          );

          gen.update({
            model: process.env.GEMINI_MODEL!,
            input: augmentedPrompt,
            output: res.text,
            usageDetails: res.usageMetadata
              ? {
                  promptTokens: res.usageMetadata.promptTokenCount,
                  completionTokens: res.usageMetadata.candidatesTokenCount,
                  totalTokens: res.usageMetadata.totalTokenCount,
                }
              : undefined,
          });

          return res;
        },
        { asType: "generation" },
      );

      const parsed = JSON.parse(response.text ?? "{}");
      trace.update({ output: parsed.days });

      logStep("service:itinerary", "Itinerario parseado", {
        dias: parsed.days?.length ?? 0,
      });

      if (actualizarMemoria) {
        updateUserMemory(userId, promptOriginal, memoria);
      }
      return parsed.days;
    });
  });
}

/**
 * Generación streaming: usada por la route SSE. Devuelve el stream crudo de
 * Gemini; la route se encarga de ir parseando/emitiendo día por día.
 */
export async function streamItinerary(prompt: string, userId: string) {
  return propagateAttributes({ userId }, async () => {
    const trace = startObservation("stream-itinerary", {
      input: prompt,
    });

    const augmentedPrompt = await buildFinalPrompt(prompt, trace);
    const memoria = await getMemory(userId);

    assertBudgetOk();

    const generation = trace.startObservation(
      "gemini-call",
      { model: process.env.GEMINI_MODEL!, input: augmentedPrompt },
      { asType: "generation" },
    );

    // El retry solo cubre el arranque del stream (antes de emitir el primer
    // chunk). Una vez que empieza a iterar, ya se le mandaron datos parciales
    // al cliente por SSE y no se puede reintentar sin duplicar contenido.
    const stream = await conReintento(() =>
      ai.models.generateContentStream({
        model: process.env.GEMINI_MODEL!,
        contents: augmentedPrompt,
        config: {
          systemInstruction: buildSystemInstruction(memoria),
          responseMimeType: "application/json",
          responseSchema: itinerarySchema,
          maxOutputTokens: MAX_OUTPUT_TOKENS_ITINERARY,
        },
      }),
    );

    // Gemini manda usageMetadata en cada chunk (acumulativo); nos quedamos con
    // el del último para loguear el costo real de todo el stream una sola vez.
    // el * significa que es una función generadora, que produce resultados de
    // forma asincrónica (se consume con `for await...of`).
    async function* streamConCosto() {
      let lastUsage: GeminiUsage | undefined;
      let fullText = "";

      try {
        for await (const chunk of stream) {
          if (chunk.usageMetadata) lastUsage = chunk.usageMetadata as any;
          if (chunk.text) fullText += chunk.text;
          yield chunk;
        }

        if (lastUsage) {
          logStep("service:itinerary", "Stream finalizado (streamItinerary)", {
            lastUsage,
          });
          logRequestCost(
            "gemini-3.1-flash-lite",
            "stream-itinerary",
            lastUsage,
          );
          generation.update({
            output: fullText,
            usageDetails: {
              input: lastUsage.promptTokenCount,
              output: lastUsage.candidatesTokenCount,
              total: lastUsage.totalTokenCount!,
            },
          });
        } else {
          logWarn(
            "service:itinerary",
            "El stream terminó sin usageMetadata; no se pudo loguear el costo.",
          );
        }

        trace.update({ output: fullText });
      } catch (err) {
        generation.update({ level: "ERROR" });
        trace.update({ level: "ERROR" });
        throw err;
      } finally {
        generation.end(); // cierra el span del modelo
        trace.end(); // cierra el trace completo
      }
    }

    return { stream: streamConCosto(), memoria };
  });
}