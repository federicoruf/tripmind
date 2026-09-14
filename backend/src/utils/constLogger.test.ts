// utils/costLogger.test.ts
//
// Correr con: npx tsx --test src/utils/costLogger.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { logRequestCost, getTotalCost, getLogs } from "./costLogger";

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