// rag/computeFinalOutcome.ts
//
// Lógica pura de decisión para el tramo final del streaming: dado el array
// de días crudo (ya parseado del JSON, pero sin validar) y cuántos días ya
// se emitieron durante el streaming, decide qué eventos SSE mandar.
//
// Se separa del handler de Express a propósito: así se puede testear sin
// levantar servidor ni llamar a Gemini.

import { DaySchema, type Day } from "../schemas/itinerarySchema.zod";

export type StreamEvent =
  | { type: "day"; payload: Day }
  | {
      type: "error";
      payload: {
        stage: "schema";
        message: string;
        invalidDays?: { index: number; errors: string[] }[];
        emittedDays: number;
      };
    }
  | {
      type: "done";
      payload: {
        ok: boolean;
        status: "complete" | "partial" | "failed";
        emittedDays: number;
        totalDaysEsperados?: number;
      };
    };

/**
 * @param rawDays          El array `days` tal cual salió de JSON.parse (sin validar).
 * @param daysEmitidosInicial  Cuántos días ya se mandaron por SSE durante el streaming
 *                             (para no repetirlos).
 */
export function computeFinalOutcome(
  rawDays: unknown[],
  daysEmitidosInicial: number
): StreamEvent[] {
  const events: StreamEvent[] = [];

  if (rawDays.length === 0) {
    events.push({
      type: "error",
      payload: {
        stage: "schema",
        message: "El modelo no generó ningún día de itinerario",
        emittedDays: 0,
      },
    });
    events.push({
      type: "done",
      payload: { ok: false, status: "failed", emittedDays: 0 },
    });
    return events;
  }

  let daysEmitidos = daysEmitidosInicial;
  const invalidDays: { index: number; errors: string[] }[] = [];

  for (let i = daysEmitidos; i < rawDays.length; i++) {
    const dayCheck = DaySchema.safeParse(rawDays[i]);

    if (dayCheck.success) {
      events.push({ type: "day", payload: dayCheck.data });
      daysEmitidos++;
    } else {
      invalidDays.push({
        index: i,
        errors: dayCheck.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        ),
      });
    }
  }

  const status: "complete" | "partial" =
    invalidDays.length === 0 && daysEmitidos === rawDays.length
      ? "complete"
      : "partial";

  if (invalidDays.length > 0) {
    events.push({
      type: "error",
      payload: {
        stage: "schema",
        message: "Algunos días del itinerario no se pudieron generar correctamente",
        invalidDays,
        emittedDays: daysEmitidos,
      },
    });
  }

  events.push({
    type: "done",
    payload: {
      ok: status === "complete",
      status,
      emittedDays: daysEmitidos,
      totalDaysEsperados: rawDays.length,
    },
  });

  return events;
}