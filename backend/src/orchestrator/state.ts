// orchestrator/state.ts
//
// Paso 10 — Estado compartido del grafo planificador ⇄ validador.
//
// Este objeto es lo único que viaja entre nodos: cada nodo recibe el estado
// completo y devuelve solo las claves que cambia (LangGraph mergea el resto).

import { Annotation } from "@langchain/langgraph";
import { Day } from "../schemas/itinerarySchema.zod";
import { ORCHESTRATOR_MAX_INTENTOS } from "../constans";

export interface ValidationResult {
  valido: boolean;
  // Motivos accionables del rechazo. Se usan para armar el prompt de
  // corrección del siguiente intento del planificador. Vacío si valido=true.
  motivos: string[];
}

export const OrchestratorState = Annotation.Root({
  // --- Entrada, no cambia entre nodos ---
  prompt: Annotation<string>(),
  userId: Annotation<string>(),

  // --- Itinerario propuesto en el intento actual ---
  itinerary: Annotation<Day[]>({
    reducer: (_anterior, nuevo) => nuevo,
    default: () => [],
  }),

  // --- Resultado de la última pasada del validador ---
  // null antes de la primera validación.
  validation: Annotation<ValidationResult | null>({
    reducer: (_anterior, nuevo) => nuevo,
    default: () => null,
  }),

  // --- Control de reintentos ---
  intentos: Annotation<number>({
    reducer: (_anterior, nuevo) => nuevo,
    default: () => 0,
  }),
  maxIntentos: Annotation<number>({
    reducer: (_anterior, nuevo) => nuevo,
    default: () => ORCHESTRATOR_MAX_INTENTOS,
  }),
});

// Tipo TS inferido del schema de arriba — se usa como firma de los nodos.
export type OrchestratorStateType = typeof OrchestratorState.State;