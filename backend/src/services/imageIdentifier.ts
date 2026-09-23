// services/imageIdentifier.ts
//
// Paso 11 (fase A): identifica el lugar de una foto que sube el usuario, o
// sugiere destinos similares si no es un lugar puntual. No toca RAG, memoria
// ni el orquestador — su única salida es un texto corto que el frontend le
// pasa como prompt normal a /api/itinerary/stream (mismo flujo de siempre).

import { GoogleGenAI } from "@google/genai";
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import { imageIdentifySchema } from "../schemas/imageIdentifySchema";
import { ImageIdentifySchema, ImageIdentifyResult } from "../schemas/imageIdentifySchema.zod";
import { logRequestCost, assertBudgetOk } from "../utils/costLogger";
import { conReintento } from "../utils/geminiRetry";
import { MAX_OUTPUT_TOKENS_IMAGE_IDENTIFY } from "../constans";
import { logStep, logError } from "../utils/logger";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_INSTRUCTION =
  "Identificá el lugar de la imagen. Si es un lugar puntual y reconocible " +
  "(un monumento, una ciudad, un paisaje famoso), devolvé su nombre y país. " +
  "Si no es un lugar puntual (ej: 'una playa', 'un bosque con niebla'), " +
  "no inventes un lugar: marcá esLugarPuntual en false y sugerí 2 o 3 " +
  "destinos reales y visitables donde se puede vivir una experiencia similar.";

export async function identifyPlace(
  imageBase64: string,
  mimeType: string,
  userId: string,
): Promise<ImageIdentifyResult> {
  assertBudgetOk();

  logStep("service:imageIdentifier", "Identificando lugar en imagen", {
    userId,
    mimeType,
  });

  return startActiveObservation("identify-place", async (trace) => {
    return propagateAttributes({ userId }, async () => {
      trace.update({ input: { mimeType } });

      // Observación de tipo "generation": acá es donde Langfuse muestra
      // tokens y costo (el span padre "identify-place" no los calcula por
      // sí solo). Mismo patrón que "tool-loop-decision-N" en toolLoop.ts.
      const generation = trace.startObservation(
        "identify-place-generation",
        { model: process.env.GEMINI_MODEL!, input: { mimeType } },
        { asType: "generation" },
      );

      const response = await conReintento(() =>
        ai.models.generateContent({
          model: process.env.GEMINI_MODEL!,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: imageBase64 } },
                { text: "Identificá esta imagen." },
              ],
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: imageIdentifySchema,
            maxOutputTokens: MAX_OUTPUT_TOKENS_IMAGE_IDENTIFY,
          },
        }),
      );

      generation
      .update({
        output: response.text,
        usageDetails: response.usageMetadata
            ? {
                input: response.usageMetadata.promptTokenCount ?? 0,
                output: response.usageMetadata.candidatesTokenCount ?? 0,
                total: response.usageMetadata.totalTokenCount ?? 0,
              }
            : undefined,
      })
      .end();

      if (response.usageMetadata) {
        logRequestCost(process.env.GEMINI_MODEL!, "identify-place", response.usageMetadata);
      }

      let parsed: ImageIdentifyResult;
      try {
        parsed = ImageIdentifySchema.parse(JSON.parse(response.text ?? "{}"));
      } catch (err) {
        logError("service:imageIdentifier", "Respuesta de Gemini no cumple el schema esperado", err);
        throw new Error("No se pudo interpretar la imagen. Probá con otra foto.");
      }

      trace.update({ output: parsed });

      logStep("service:imageIdentifier", "Lugar identificado", {
        esLugarPuntual: parsed.esLugarPuntual,
        lugar: parsed.lugar || undefined,
        sugerencias: parsed.sugerencias.length,
      });

      return parsed;
    });
  });
}
