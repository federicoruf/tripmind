import {
    GoogleGenAI,
    FunctionCallingConfigMode,
  } from "@google/genai";
import { getPlaces, getWeather } from "../tools/tripTools";
import { assertBudgetOk, logRequestCost } from "../utils/costLogger";
import { conReintento } from "../utils/geminiRetry";
import { tripDeclarations } from "../tools/tripDeclarations";
import { MAX_OUTPUT_TOKENS_TOOL_LOOP, MAX_TOOL_DATA_CHARS, MAX_TOOL_LOOP_ITERATIONS } from "../constans";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Fase 1: loop de tool use (sin responseSchema).
 * Devuelve un string con todos los resultados de tools recolectados,
 * listo para insertar en el prompt aumentado.
 */

function truncateToolData(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...truncado]";
}

export async function resolveToolData(prompt: string): Promise<string> {
  const contents: any[] = [{ role: "user", parts: [{ text: prompt }] }];
  const collected: string[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (let iteracion = 0; iteracion < MAX_TOOL_LOOP_ITERATIONS; iteracion++) {
    assertBudgetOk();

    const response = await conReintento(() =>
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL!,
        contents,
        config: {
          tools: [{ functionDeclarations: tripDeclarations }],
          toolConfig: {
            functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
          },
          systemInstruction: `Hoy es ${today}. Cuando resuelvas fechas relativas mencionadas por el usuario ("octubre", "el mes que viene"), usá las próximas ocurrencias a partir de hoy, nunca años anteriores.`,
          maxOutputTokens: MAX_OUTPUT_TOKENS_TOOL_LOOP,
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
    const calls = response.functionCalls ?? [];
    if (calls.length === 0) break;

    if (iteracion === MAX_TOOL_LOOP_ITERATIONS - 1) {
      console.warn(
        `[resolveToolData] Se alcanzó el máximo de ${MAX_TOOL_LOOP_ITERATIONS} iteraciones de tool-use; se corta el loop con los datos recolectados hasta ahora.`,
      );
      break;
    }

    contents.push({
      role: "model",
      parts: response.candidates![0].content!.parts,
    });

    const functionResponses = await Promise.all(
      calls.map(async (call) => {
        let result;
        if (call.name === "get_weather") {
          result = await getWeather(
            call.args!.city as string,
            call.args!.date as string,
          );
        } else if (call.name === "get_places") {
          result = await getPlaces(
            call.args!.city as string,
            call.args!.category as "naturaleza" | "comida" | "cultura",
          );
        }
        collected.push(`[${call.name}] ${JSON.stringify(result)}`);
        return { functionResponse: { name: call.name, response: { result } } };
      }),
    );

    contents.push({ role: "user", parts: functionResponses });
  }

  return truncateToolData(collected.join("\n"), MAX_TOOL_DATA_CHARS);
}
