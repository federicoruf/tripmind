// utils/costLogger.test.ts
//
// Correr con: npx tsx --test src/utils/costLogger.test.ts

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import {
  logRequestCost,
  getTotalCost,
  getLogs,
  assertBudgetOk,
  _resetAvisoParaTests,
} from "./costLogger";

describe("costLogger", () => {
  test("calcula bien el costo para gemini-3.1-flash-lite", () => {
    const entry = logRequestCost("gemini-3.1-flash-lite", "test-route", {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 1_000_000,
    });

    // input $0.25/M + output $1.50/M = $1.75 por 1M+1M tokens
    assert.equal(entry.costUsd, 1.75);
  });

  test("modelo desconocido no rompe, pero da costo 0", () => {
    const entry = logRequestCost("modelo-que-no-existe", "test-route", {
      promptTokenCount: 500,
      candidatesTokenCount: 500,
    });

    assert.equal(entry.costUsd, 0);
  });

  test("getTotalCost() acumula todas las llamadas registradas", () => {
    const antes = getTotalCost();

    logRequestCost("gemini-3.1-flash-lite", "test-route", {
      promptTokenCount: 1000,
      candidatesTokenCount: 1000,
    });

    const despues = getTotalCost();
    assert.ok(despues > antes, "el total debería crecer después de loguear una llamada más");
  });

  test("getLogs() guarda cada llamada con su ruta (route)", () => {
    logRequestCost("gemini-3.1-flash-lite", "stream-itinerary", {
      promptTokenCount: 100,
      candidatesTokenCount: 100,
    });

    const logs = getLogs();
    const ultimo = logs[logs.length - 1];
    assert.equal(ultimo.route, "stream-itinerary");
  });
});

describe("assertBudgetOk", () => {
  // getTotalCost() acumula sobre TODO el proceso (mismo diseño que el resto
  // del módulo), así que cada test usa su propio presupuesto relativo al
  // gasto ya acumulado, en vez de valores absolutos.
  before(() => {
    _resetAvisoParaTests();
  });

  test("no tira error si el gasto está por debajo del presupuesto", () => {
    const gastoActual = getTotalCost();
    process.env.GEMINI_MAX_BUDGET_USD = String(gastoActual + 10);

    assert.doesNotThrow(() => assertBudgetOk());
  });

  test("tira error si el gasto ya alcanzó el presupuesto", () => {
    const gastoActual = getTotalCost();
    // Presupuesto ya consumido por completo (o de menos).
    process.env.GEMINI_MAX_BUDGET_USD = String(Math.max(gastoActual - 0.000001, 0));

    assert.throws(() => assertBudgetOk(), /Presupuesto de Gemini agotado/);
  });

  test("loguea un warning una sola vez al cruzar el 80% del presupuesto", () => {
    _resetAvisoParaTests();
    const gastoActual = getTotalCost();
    // Presupuesto tal que el gasto actual ya es justo el 80%.
    process.env.GEMINI_MAX_BUDGET_USD = String(gastoActual / 0.8);

    const warnOriginal = console.warn;
    let llamadasWarn = 0;
    console.warn = (...args: any[]) => {
      llamadasWarn++;
      warnOriginal(...args);
    };

    try {
      assertBudgetOk(); // cruza el 80% -> debería avisar
      assertBudgetOk(); // ya avisó antes -> no debería volver a avisar
    } finally {
      console.warn = warnOriginal;
    }

    assert.equal(llamadasWarn, 1);
  });
});