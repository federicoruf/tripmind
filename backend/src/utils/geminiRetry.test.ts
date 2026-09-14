// utils/geminiRetry.test.ts
//
// Correr con: npx tsx --test src/utils/geminiRetry.test.ts

import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";
import { conReintento } from "./geminiRetry";

// Simula el shape de error que devuelve el SDK de Gemini.
function errorGemini(
  status: number,
  reason?: "quota_exceeded" | "rate_limit_exceeded",
  retryDelay?: string,
) {
  const details: any[] = [];
  if (reason) {
    details.push({ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason });
  }
  if (retryDelay) {
    details.push({ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay });
  }
  // Debe ser un Error real (no un objeto plano): conReintento y assert.rejects
  // leen/comparan contra `.message`.
  const err: any = new Error(`HTTP ${status}`);
  err.status = status;
  err.error = { code: status, details };
  return err;
}

describe("conReintento", () => {
  test("si fn() no falla, devuelve el resultado sin reintentar", async () => {
    const fn = mock.fn(async () => "ok");

    const resultado = await conReintento(fn);

    assert.equal(resultado, "ok");
    assert.equal(fn.mock.callCount(), 1);
  });

  test("429 rate_limit_exceeded: reintenta y termina devolviendo el resultado", async () => {
    let llamada = 0;
    const fn = mock.fn(async () => {
      llamada++;
      if (llamada < 3) {
        throw errorGemini(429, "rate_limit_exceeded", "0s"); // 0s para no esperar en el test
      }
      return "ok-al-tercer-intento";
    });

    const resultado = await conReintento(fn, 3);

    assert.equal(resultado, "ok-al-tercer-intento");
    assert.equal(fn.mock.callCount(), 3);
  });

  test("503: también reintenta como rate_limit_exceeded", async () => {
    let llamada = 0;
    const fn = mock.fn(async () => {
      llamada++;
      if (llamada < 2) throw errorGemini(503);
      return "ok";
    });

    const resultado = await conReintento(fn, 3);

    assert.equal(resultado, "ok");
    assert.equal(fn.mock.callCount(), 2);
  });

  test("429 quota_exceeded: NO reintenta, corta en el primer intento", async () => {
    const fn = mock.fn(async () => {
      throw errorGemini(429, "quota_exceeded");
    });

    await assert.rejects(
      () => conReintento(fn, 3),
      /Cuota diaria de Gemini agotada/,
    );
    assert.equal(fn.mock.callCount(), 1);
  });

  test("error no recuperable (ej. 400/401): NO reintenta", async () => {
    const fn = mock.fn(async () => {
      throw errorGemini(401);
    });

    await assert.rejects(() => conReintento(fn, 3));
    assert.equal(fn.mock.callCount(), 1);
  });

  test("si sigue fallando con error reintentable tras agotar los intentos, tira el error original", async () => {
    const fn = mock.fn(async () => {
      throw errorGemini(429, "rate_limit_exceeded", "0s");
    });

    await assert.rejects(() => conReintento(fn, 3), /HTTP 429/);
    assert.equal(fn.mock.callCount(), 3);
  });
});