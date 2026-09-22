import { LangfuseObservation } from "@langfuse/tracing";
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import { getPlaces, getWeather } from "../tools/tripTools";
import { assertBudgetOk, logRequestCost } from "../utils/costLogger";
import { conReintento } from "../utils/geminiRetry";
import { tripDeclarations } from "../tools/tripDeclarations";
import { MAX_OUTPUT_TOKENS_TOOL_LOOP, MAX_TOOL_DATA_CHARS, MAX_TOOL_LOOP_ITERATIONS } from "../constans";
import { logStep, logWarn, previewTexto } from "../utils/logger";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function resolveToolData(prompt: string, trace: LangfuseObservation): Promise<string> {
  logStep("service:toolLoop", "Resolviendo datos de tools", {
    prompt: previewTexto(prompt),
  });

  const contents: any[] = [{ role: "user", parts: [{ text: prompt }] }];
  const collected: string[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (let iteracion = 0; iteracion < MAX_TOOL_LOOP_ITERATIONS; iteracion++) {
    assertBudgetOk();

    // Span de la decisión de Gemini (qué tool llamar, si alguna)
    const decisionGen = trace.startObservation(
      `tool-loop-decision-${iteracion}`,
      { model: process.env.GEMINI_MODEL!, input: contents },
      { asType: "generation" },
    );

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
      logRequestCost("gemini-3.1-flash-lite", "generate-itinerary", response.usageMetadata);
    }

    const calls = response.functionCalls ?? [];

    logStep("service:toolLoop", `Iteración ${iteracion}: decisión de Gemini`, {
      calls: calls.map((call) => call.name),
    });

    decisionGen
      .update({
        output: calls.length ? calls : response.text,
        usageDetails: response.usageMetadata
          ? {
              input: response.usageMetadata.promptTokenCount,
              output: response.usageMetadata.candidatesTokenCount,
              total: response.usageMetadata.totalTokenCount,
            }
          : undefined,
      })
      .end();

    if (calls.length === 0) break;

    if (iteracion === MAX_TOOL_LOOP_ITERATIONS - 1) {
      logWarn(
        "service:toolLoop",
        `Se alcanzó el máximo de ${MAX_TOOL_LOOP_ITERATIONS} iteraciones de tool-use; se corta el loop con los datos recolectados hasta ahora.`,
      );
      break;
    }

    contents.push({ role: "model", parts: response.candidates![0].content!.parts });

    const functionResponses = await Promise.all(
      calls.map(async (call) => {
        // Span propio por cada tool call (get_weather / get_places)
        const toolSpan = trace.startObservation(
          call.name!,
          { input: call.args },
          { asType: "tool" },
        );

        let result;
        try {
          logStep("service:toolLoop", "Ejecutando tool", {
            tool: call.name,
            args: call.args,
          });
          if (call.name === "get_weather") {
            result = await getWeather(call.args!.city as string, call.args!.date as string);
          } else if (call.name === "get_places") {
            result = await getPlaces(
              call.args!.city as string,
              call.args!.category as "naturaleza" | "comida" | "cultura",
            );
          }
          toolSpan.update({ output: result });
        } catch (err) {
          toolSpan.update({ level: "ERROR", statusMessage: String(err) });
          throw err;
        } finally {
          toolSpan.end();
        }

        collected.push(`[${call.name}] ${JSON.stringify(result)}`);
        return { functionResponse: { name: call.name, response: { result } } };
      }),
    );

    contents.push({ role: "user", parts: functionResponses });
  }

  const resultado = truncateToolData(collected, MAX_TOOL_DATA_CHARS);
  logStep("service:toolLoop", "Datos de tools listos", {
    entradas: collected.length,
    chars: resultado.length,
  });
  return resultado;
}

/**
 * Arma el bloque final de resultados de tools sin superar `maxChars`,
 * cortando por ENTRADA COMPLETA (cada elemento de `entradas` es un
 * "[nombre_tool] {json}" completo), nunca a mitad de un carácter — cortar
 * un JSON a la mitad confunde más al modelo que si esa entrada no estuviera.
 */
function truncateToolData(entradas: string[], maxChars: number): string {
  const incluidas: string[] = [];
  let longitudAcumulada = 0;
  let seOmitieronEntradas = false;

  for (const entrada of entradas) {
    const longitudConSalto = entrada.length + 1; // +1 por el "\n" al unir
    if (longitudAcumulada + longitudConSalto > maxChars) {
      seOmitieronEntradas = true;
      break;
    }
    incluidas.push(entrada);
    longitudAcumulada += longitudConSalto;
  }

  // Caso borde: ni siquiera la primera entrada entra completa en el límite.
  // No debería pasar con get_weather/get_places (devuelven JSON chico), pero
  // si pasara, preferimos devolver algo (truncado y marcado como tal) antes
  // que un bloque vacío.
  if (incluidas.length === 0 && entradas.length > 0) {
    return entradas[0].slice(0, maxChars) + "\n[...entrada truncada por tamaño]";
  }

  const texto = incluidas.join("\n");
  return seOmitieronEntradas
    ? `${texto}\n[...se omitieron ${entradas.length - incluidas.length} resultado(s) de tools por límite de tamaño]`
    : texto;
}