// src/services/itinerarySummary.ts
//
// Servicio para generar resumenes concisos de itinerarios.
// Usa el mismo modelo de Gemini que el resto de la aplicacion.
// El resumen debe ser max 500 caracteres y cubrir:
// - Destino principal
// - Duracion aproximada
// - Tipo de viaje
// - Intereses principales

import { GoogleGenAI } from "@google/genai";
import { conReintento } from "../utils/geminiRetry";
import { logStep, logError } from "../utils/logger";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MAX_SUMMARY_LENGTH = 500;

/**
 * Genera un resumen de un itinerario.
 * 
 * @param itineraryJson - JSON del itinerario generado
 * @param prompt - Prompt original del usuario (para contexto)
 * @returns Resumen de max 500 caracteres
 */
export async function generateSummary(
  itineraryJson: string,
  prompt: string,
): Promise<string> {
  try {
    const summary = await conReintento(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Eres un asistente de viaje. Genera un resumen CONCISO (MAXIMO ${MAX_SUMMARY_LENGTH} caracteres) para este itinerario. 
Incluye solo: destino principal, duracion aproximada, tipo de viaje y intereses principales.
Usa el idioma del prompt del usuario.

Prompt del usuario: ${prompt}

Itinerario (JSON): ${itineraryJson.substring(0, 15000)}`,
              },
            ],
          },
        ],
        config: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
      });

      // Get the text from the response
      const candidate = response.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text ?? "";
      return text;
    });

    // Recortar a MAX_SUMMARY_LENGTH por si acaso
    const trimmedSummary = summary.trim().substring(0, MAX_SUMMARY_LENGTH);

    logStep("services:itinerarySummary", "Resumen generado", {
      length: trimmedSummary.length,
    });

    return trimmedSummary;
  } catch (error) {
    logError("services:itinerarySummary", "Error generando resumen", error);
    // Fallback: usar el prompt truncado si falla la generacion
    return prompt.substring(0, MAX_SUMMARY_LENGTH);
  }
}
