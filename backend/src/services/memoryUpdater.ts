import { GoogleGenAI } from "@google/genai";
import { conReintento } from "../utils/geminiRetry";
import { saveMemory } from "../memory";
import { MAX_OUTPUT_TOKENS_MEMORY } from "../constans";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function updateUserMemory(
    userId: string,
    prompt: string,
    memoriaAnterior: string | null,
  ): Promise<void> {
    try {
      const instructionMemoria = `Sos un asistente que actualiza un perfil de preferencias de viaje.
      
      Memoria actual del usuario (puede estar vacía): "${memoriaAnterior ?? "(sin datos previos)"}"
      
      Nuevo mensaje del usuario: "${prompt}"
      
      Actualizá el resumen de preferencias en máximo 3 líneas, combinando lo que ya
      se sabía con cualquier preferencia NUEVA que aparezca en el nuevo mensaje
      (ej: ritmo de viaje, presupuesto, intereses, restricciones como horarios o
      mascotas). Si no hay nada nuevo relevante, devolvé la memoria actual sin
      cambios. Respondé SOLO con el resumen, sin explicaciones.`;
  
      const response = await conReintento(() =>
        ai.models.generateContent({
          model: process.env.GEMINI_MODEL!,
          contents: prompt,
          config: {
            systemInstruction: instructionMemoria,
            maxOutputTokens: MAX_OUTPUT_TOKENS_MEMORY,
          },
        }),
      );
  
      const nuevoResumen = response.text?.trim();
      if (nuevoResumen) {
        await saveMemory(userId, nuevoResumen);
      }
    } catch (err) {
      // La memoria es un "extra": si falla, no debe romper la respuesta principal
      console.error("[updateUserMemory] Error actualizando memoria:", err);
    }
  }