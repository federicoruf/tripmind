// orchestrator/nodes/planificador.ts
//
// Paso 10 — Nodo "planificador" del grafo.
//
// Reusa la lógica ya existente de generación (RAG + tools + memoria vía
// generateItinerary) en vez de duplicarla. Lo único nuevo acá es: si este
// nodo se ejecuta como reintento (porque el validador rechazó la vuelta
// anterior), le agrega al prompt las correcciones pedidas.

import { generateItinerary } from "../../services/itinerary";
import { OrchestratorStateType } from "../state";
import { logStep } from "../../utils/logger";

export async function planificadorNode(
  state: OrchestratorStateType,
): Promise<Partial<OrchestratorStateType>> {
  const esReintento = state.intentos > 0 && state.validation?.valido === false;

  logStep("orchestrator:planificador", `Intento ${state.intentos + 1}`, {
    esReintento,
    motivosPrevios: esReintento ? state.validation!.motivos : undefined,
  });

  const promptParaGemini = esReintento
    ? construirPromptDeCorreccion(state.prompt, state.validation!.motivos)
    : state.prompt;

  const itinerary = await generateItinerary(promptParaGemini, state.userId, {
    // El prompt original (limpio) es el que se guarda en la memoria de
    // preferencias del usuario, nunca el prompt de corrección.
    promptOriginal: state.prompt,
    // La memoria se actualiza una sola vez al final del grafo (Paso 5/7),
    // no en cada intento — evita llamadas redundantes al LLM de memoria.
    actualizarMemoria: false,
  });

  logStep("orchestrator:planificador", "Itinerario generado", {
    dias: itinerary.length,
  });

  return {
    itinerary,
    intentos: state.intentos + 1,
  };
}

function construirPromptDeCorreccion(
  promptOriginal: string,
  motivos: string[],
): string {
  return `${promptOriginal}

IMPORTANTE: ya generaste una versión de este itinerario y no pasó una revisión
de calidad. Corregí los siguientes problemas y generá el itinerario COMPLETO
de nuevo (no describas los cambios, no devuelvas solo los días con error):
${motivos.map((motivo) => `- ${motivo}`).join("\n")}`;
}