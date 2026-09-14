// rag/computeFinalOutcome.test.ts
//
// Correr con: npx tsx --test rag/computeFinalOutcome.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeFinalOutcome } from "./computeFinalOutcome";

const diaValido = {
  day: 1,
  title: "Llegada a Lisboa",
  activities: [{ time: "09:00", description: "Check-in", location: "Alfama", source: "" }],
};

const diaInvalido = {
  day: 2,
  title: "Sintra",
  activities: [{ description: "Falta el time" }], // sin 'time' requerido
};

describe("computeFinalOutcome", () => {
  test("rawDays vacío → error + done(status: 'failed'), sin importar daysEmitidosInicial", () => {
    const events = computeFinalOutcome([], 0);

    assert.equal(events.length, 2);
    assert.equal(events[0].type, "error");
    assert.equal(events[1].type, "done");
    if (events[1].type === "done") {
      assert.equal(events[1].payload.status, "failed");
      assert.equal(events[1].payload.ok, false);
      assert.equal(events[1].payload.emittedDays, 0);
    }
  });

  test("todos los días válidos y ninguno emitido antes → 'complete', emite todos por SSE", () => {
    const events = computeFinalOutcome([diaValido, diaValido], 0);

    const dayEvents = events.filter((e) => e.type === "day");
    const doneEvent = events.find((e) => e.type === "done");

    assert.equal(dayEvents.length, 2);
    assert.ok(doneEvent);
    if (doneEvent?.type === "done") {
      assert.equal(doneEvent.payload.status, "complete");
      assert.equal(doneEvent.payload.ok, true);
      assert.equal(doneEvent.payload.emittedDays, 2);
      assert.equal(doneEvent.payload.totalDaysEsperados, 2);
    }
  });

  test("un solo día válido (regresión del bug viejo: antes 'complete' exigía emittedDays > 0 en un lugar raro)", () => {
    const events = computeFinalOutcome([diaValido], 0);
    const doneEvent = events.find((e) => e.type === "done");

    assert.ok(doneEvent);
    if (doneEvent?.type === "done") {
      assert.equal(doneEvent.payload.status, "complete");
    }
  });

  test("un día inválido entre dos válidos → 'partial', reporta invalidDays con index y errors", () => {
    const events = computeFinalOutcome([diaValido, diaInvalido, diaValido], 0);

    const dayEvents = events.filter((e) => e.type === "day");
    const errorEvent = events.find((e) => e.type === "error");
    const doneEvent = events.find((e) => e.type === "done");

    // se emiten los 2 días válidos (índices 0 y 2), se salta el inválido (índice 1)
    assert.equal(dayEvents.length, 2);

    assert.ok(errorEvent);
    if (errorEvent?.type === "error") {
      assert.equal(errorEvent.payload.stage, "schema");
      assert.equal(errorEvent.payload.invalidDays?.length, 1);
      assert.equal(errorEvent.payload.invalidDays?.[0].index, 1);
      assert.ok(
        errorEvent.payload.invalidDays?.[0].errors.some((e) => e.includes("time"))
      );
    }

    assert.ok(doneEvent);
    if (doneEvent?.type === "done") {
      assert.equal(doneEvent.payload.status, "partial");
      assert.equal(doneEvent.payload.ok, false);
      assert.equal(doneEvent.payload.emittedDays, 2);
      assert.equal(doneEvent.payload.totalDaysEsperados, 3);
    }
  });

  test("respeta daysEmitidosInicial: no vuelve a emitir días ya mandados durante el streaming", () => {
    // simula que durante el streaming ya se emitió el día 0 (índice 0)
    const events = computeFinalOutcome([diaValido, diaValido], 1);

    const dayEvents = events.filter((e) => e.type === "day");
    // solo debería re-procesar desde índice 1 en adelante → 1 día emitido acá
    assert.equal(dayEvents.length, 1);

    const doneEvent = events.find((e) => e.type === "done");
    if (doneEvent?.type === "done") {
      // emittedDays cuenta el total acumulado, incluyendo lo ya emitido antes
      assert.equal(doneEvent.payload.emittedDays, 2);
      assert.equal(doneEvent.payload.status, "complete");
    }
  });

  test("todos los días inválidos → 'partial' con emittedDays: 0 (no 'failed', porque sí hay rawDays)", () => {
    const events = computeFinalOutcome([diaInvalido, diaInvalido], 0);

    const dayEvents = events.filter((e) => e.type === "day");
    const doneEvent = events.find((e) => e.type === "done");

    assert.equal(dayEvents.length, 0);
    if (doneEvent?.type === "done") {
      assert.equal(doneEvent.payload.status, "partial");
      assert.equal(doneEvent.payload.emittedDays, 0);
    }
  });
});