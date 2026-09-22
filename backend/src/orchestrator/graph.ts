// orchestrator/graph.ts
//
// Paso 10 — Arma y compila el grafo: planificador → validador → (retry o fin).
//
// Este es el único archivo que el resto de la app necesita importar; expone
// runOrchestratedItinerary como reemplazo orquestado de generateItinerary.

import { StateGraph, START, END } from "@langchain/langgraph";
import { OrchestratorState, OrchestratorStateType, ValidationResult } from "./state";
import { planificadorNode } from "./nodes/planificador";
import { validadorNode } from "./nodes/validador";
import { Day } from "../schemas/itinerarySchema.zod";
import { getMemory } from "../memory";
import { updateUserMemory } from "../services/memoryUpdater";
import { logStep, previewTexto } from "../utils/logger";

type SiguientePaso = "reintentar" | "finalizar";

/**
 * Edge condicional después del validador:
 * - válido → finalizar (fin del grafo, se devuelve tal cual).
 * - inválido pero quedan reintentos → volver al planificador con el feedback.
 * - inválido y sin reintentos → finalizar igual (se devuelve el último
 *   intento, mejor eso que no responderle nada al usuario).
 */
function decidirSiguientePaso(state: OrchestratorStateType): SiguientePaso {
  const esValido = state.validation?.valido === true;
  const quedanIntentos = state.intentos < state.maxIntentos;

  if (esValido || !quedanIntentos) return "finalizar";
  return "reintentar";
}

const grafo = new StateGraph(OrchestratorState)
  .addNode("planificador", planificadorNode)
  .addNode("validador", validadorNode)
  .addEdge(START, "planificador")
  .addEdge("planificador", "validador")
  .addConditionalEdges("validador", decidirSiguientePaso, {
    reintentar: "planificador",
    finalizar: END,
  })
  .compile();

export interface OrchestratorResult {
  itinerary: Day[];
  validacionFinal: ValidationResult | null;
  intentos: number;
  // true si se agotaron los reintentos y el itinerario se entrega sin haber
  // pasado la validación — la route puede usar esto para avisarle al
  // usuario, en vez de mostrarlo como si nada.
  entregadoSinValidarCompleto: boolean;
}

export async function runOrchestratedItinerary(
  prompt: string,
  userId: string,
): Promise<OrchestratorResult> {
  logStep("orchestrator:graph", "Iniciando grafo (planificador ⇄ validador)", {
    userId,
    prompt: previewTexto(prompt),
  });

  const resultado = await grafo.invoke({ prompt, userId });

  logStep("orchestrator:graph", "Grafo finalizado", {
    intentos: resultado.intentos,
    valido: resultado.validation?.valido ?? null,
  });

  // Se hace acá, una sola vez, con el prompt ORIGINAL del usuario — sin
  // importar si el planificador tuvo que reintentar 0, 1 o 2 veces con
  // prompts de corrección internos, que nunca deben llegar a la memoria.
  logStep("orchestrator:graph", "Actualizando memoria de usuario", { userId });
  const memoriaAnterior = await getMemory(userId);
  await updateUserMemory(userId, prompt, memoriaAnterior);
  logStep("orchestrator:graph", "Memoria de usuario actualizada", { userId });

  return {
    itinerary: resultado.itinerary,
    validacionFinal: resultado.validation,
    intentos: resultado.intentos,
    entregadoSinValidarCompleto: resultado.validation?.valido !== true,
  };
}