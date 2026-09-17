// services/itinerary.ts
import {
  GoogleGenAI,
} from "@google/genai";
import { itinerarySchema } from "../schemas/itinerarySchema";
import { Day } from "../schemas/itinerarySchema.zod";
import { logRequestCost, GeminiUsage, assertBudgetOk } from "../utils/costLogger";
import { conReintento } from "../utils/geminiRetry";
import { getMemory } from "../memory";
import { buildSystemInstruction } from "../utils/buildSystemInstruction";
import { buildFinalPrompt } from "./promptBuilder";
import { MAX_OUTPUT_TOKENS_ITINERARY } from "../constans";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Generación NO streaming: usada por el eval, tests, o cualquier consumidor
 * que solo necesite el itinerario final ya armado (sin ir emitiendo por SSE).
 */
export async function generateItinerary(prompt: string, userId: string): Promise<Day[]> {
  const augmentedPrompt = await buildFinalPrompt(prompt);
  const memoria = await getMemory(userId);

  assertBudgetOk();
  const response = await conReintento(() =>
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
  
  if (response.usageMetadata) {
    logRequestCost(
      "gemini-3.1-flash-lite",
      "generate-itinerary",
      response.usageMetadata,
    );
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    console.warn(
      `[generateItinerary] finishReason="${finishReason}" (no fue "STOP") — ` +
        `la respuesta puede estar cortada. Prompt: "${prompt}"`,
    );
  }

  const rawText = response.text ?? "";
  if (!rawText.trim()) {
    console.error(
      `[generateItinerary] Respuesta vacía del modelo. finishReason="${finishReason}". Prompt: "${prompt}"`,
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText || "{}");
  } catch (err) {
    console.error(
      `[generateItinerary] JSON inválido. finishReason="${finishReason}". ` +
        `Texto crudo (primeros 500 chars): ${rawText.slice(0, 500)}`,
    );
    throw err;
  }

  if (!Array.isArray(parsed?.days)) {
    console.error(
      `[generateItinerary] Sin campo 'days'. finishReason="${finishReason}". ` +
        `Texto crudo (primeros 500 chars): ${rawText.slice(0, 500)}`,
    );
    throw new Error(
      "El modelo no devolvió un itinerario válido (sin campo 'days')",
    );
  }

  updateUserMemory(userId, prompt, memoria);

  return parsed.days;
}

/**
 * Generación streaming: usada por la route SSE. Devuelve el stream crudo de
 * Gemini; la route se encarga de ir parseando/emitiendo día por día.
 */
export async function streamItinerary(prompt: string, userId: string) {
  const augmentedPrompt = await buildFinalPrompt(prompt);
  const memoria = await getMemory(userId);

  assertBudgetOk();
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
  async function* streamConCosto() {
    let lastUsage: GeminiUsage | undefined;

    for await (const chunk of stream) {
      if (chunk.usageMetadata) {
        lastUsage = chunk.usageMetadata as any;
      }
      yield chunk;
    }

    if (lastUsage) {
      logRequestCost(
        "gemini-3.1-flash-lite",
        "stream-itinerary",
        lastUsage,
      );
    } else {
      console.warn(
        "[streamItinerary] El stream terminó sin usageMetadata; no se pudo loguear el costo.",
      );
    }
  }

  return { stream: streamConCosto(), memoria };
}