// orchestrator/nodes/validador.ts
//
// Paso 10 — Nodo "validador" del grafo.
//
// Dos capas, de más barata a más cara:
//   1. Reglas deterministas en código (gratis, sin llamar al LLM): días
//      duplicados/no consecutivos, actividades repetidas.
//   2. LLM-as-judge (mismo patrón que ya se documentó en el Paso 6/9):
//      coherencia del itinerario con el pedido del usuario y presupuesto.
//      Solo se ejecuta si la capa 1 no encontró nada — no tiene sentido
//      gastar una llamada al LLM para juzgar un itinerario que ya sabemos
//      que está roto estructuralmente.

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { conReintento } from "../../utils/geminiRetry";
import { assertBudgetOk } from "../../utils/costLogger";
import { MAX_OUTPUT_TOKENS_VALIDATOR } from "../../constans";
import { Day } from "../../schemas/itinerarySchema.zod";
import { OrchestratorStateType, ValidationResult } from "../state";
import { logStep, logWarn } from "../../utils/logger";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const JudgeResponseSchema = z.object({
  valido: z.boolean(),
  motivos: z.array(z.string()),
});

export async function validadorNode(
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> {
  logStep("orchestrator:validador", "Validando itinerario", {
    dias: state.itinerary.length,
  });

  const motivosEstructurales = validarReglasDeterministicas(state.itinerary);

  if (motivosEstructurales.length > 0) {
    logStep("orchestrator:validador", "Reglas deterministas: rechazado", {
      motivos: motivosEstructurales,
    });
    return { validation: { valido: false, motivos: motivosEstructurales } };
  }

  logStep("orchestrator:validador", "Reglas deterministas: OK, evaluando con LLM-judge");

  const validation = await validarConLLM(state.prompt, state.itinerary);
  return { validation };
}

/**
 * Capa 1: reglas fijas, sin costo de LLM.
 */
function validarReglasDeterministicas(itinerary: Day[]): string[] {
  const motivos: string[] = [];

  if (itinerary.length === 0) {
    return ["El itinerario no tiene ningún día."];
  }

  const numerosDeDia = itinerary.map((dia) => dia.day);
  const numerosUnicos = new Set(numerosDeDia);
  if (numerosUnicos.size !== numerosDeDia.length) {
    motivos.push("Hay números de día repetidos en el itinerario.");
  }

  const secuenciaEsperada = itinerary.map((_, indice) => indice + 1);
  const numerosOrdenados = [...numerosDeDia].sort((a, b) => a - b);
  if (JSON.stringify(numerosOrdenados) !== JSON.stringify(secuenciaEsperada)) {
    motivos.push(
      `Los días deberían ser consecutivos del 1 al ${itinerary.length} ` +
        `(se encontraron: ${numerosDeDia.join(", ")}).`,
    );
  }

  const actividadesVistas = new Set<string>();
  for (const dia of itinerary) {
    for (const actividad of dia.activities) {
      const clave = actividad.description.trim().toLowerCase();
      if (actividadesVistas.has(clave)) {
        motivos.push(
          `La actividad "${actividad.description}" aparece repetida en más de un día.`,
        );
      }
      actividadesVistas.add(clave);
    }
  }

  return motivos;
}

/**
 * Capa 2: LLM-as-judge para propiedades cualitativas que las reglas fijas
 * no pueden capturar (coherencia con el pedido, ritmo, presupuesto).
 */
async function validarConLLM(
  promptOriginal: string,
  itinerary: Day[],
): Promise<ValidationResult> {
  assertBudgetOk();

  const instruction = `Sos un revisor de calidad de itinerarios de viaje. Vas a
recibir el pedido original del usuario y un itinerario generado por otro
asistente. Evaluá SOLO estos criterios:

1. El itinerario responde al pedido del usuario (destino, cantidad de días,
   ritmo, intereses mencionados).
2. Si el usuario mencionó un presupuesto, las actividades propuestas son
   coherentes con ese presupuesto.
3. El tono y nivel de detalle es razonable para un itinerario de viaje.

No evalúes duplicados ni numeración de días: eso ya se revisó aparte.

Respondé SOLO con un JSON con esta forma exacta, sin texto adicional ni
bloques de código:
{"valido": boolean, "motivos": string[]}

"motivos" va vacío si "valido" es true. Si es false, cada motivo tiene que
ser una instrucción concreta y accionable para corregir el itinerario en un
nuevo intento (no una descripción del problema en abstracto).`;

  const response = await conReintento(() =>
    ai.models.generateContent({
      model: process.env.GEMINI_MODEL!,
      contents:
        `PEDIDO DEL USUARIO:\n${promptOriginal}\n\n` +
        `ITINERARIO GENERADO:\n${JSON.stringify(itinerary)}`,
      config: {
        systemInstruction: instruction,
        responseMimeType: "application/json",
        maxOutputTokens: MAX_OUTPUT_TOKENS_VALIDATOR,
      },
    }),
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text ?? "{}");
  } catch {
    return aceptarPorDefectoAntePudoJudge();
  }

  const result = JudgeResponseSchema.safeParse(parsed);
  if (!result.success) {
    return aceptarPorDefectoAntePudoJudge();
  }

  logStep("orchestrator:validador", "Resultado LLM-judge", {
    valido: result.data.valido,
    motivos: result.data.motivos,
  });

  return result.data;
}

/**
 * Si el judge no devuelve un formato utilizable, no bloqueamos el flujo
 * indefinidamente: se acepta el itinerario tal cual. La responsabilidad del
 * validador es agregar valor, no volverse un punto de fallo que impida
 * siempre devolver algo al usuario.
 */
function aceptarPorDefectoAntePudoJudge(): ValidationResult {
  logWarn(
    "orchestrator:validador",
    "Respuesta del judge no tiene el formato esperado; se acepta el itinerario por defecto.",
  );
  return { valido: true, motivos: [] };
}