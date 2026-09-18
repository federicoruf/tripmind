import { LangfuseObservation } from "@langfuse/tracing";
import { getPlaces, getWeather } from "../tools/tripTools";
import { assertBudgetOk, logRequestCost } from "../utils/costLogger";
import { conReintento } from "../utils/geminiRetry";
import { tripDeclarations } from "../tools/tripDeclarations";
import { MAX_OUTPUT_TOKENS_TOOL_LOOP, MAX_TOOL_DATA_CHARS, MAX_TOOL_LOOP_ITERATIONS } from "../constans";

export async function resolveToolData(prompt: string, trace: LangfuseObservation): Promise<string> {
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
      console.warn(
        `[resolveToolData] Se alcanzó el máximo de ${MAX_TOOL_LOOP_ITERATIONS} iteraciones de tool-use; se corta el loop con los datos recolectados hasta ahora.`,
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

  return truncateToolData(collected.join("\n"), MAX_TOOL_DATA_CHARS);
}