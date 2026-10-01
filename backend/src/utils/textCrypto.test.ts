// utils/textCrypto.test.ts
//
// Correr con: npx tsx --test src/utils/textCrypto.test.ts

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { encryptText, decryptText } from "./textCrypto";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

describe("textCrypto", () => {
  beforeEach(() => {
    process.env.DOCS_MASTER_KEY = KEY_A;
  });

  test("cifrar y descifrar devuelve el texto original", () => {
    const texto = "Reservé hotel en Lisboa del 3 al 7 de mayo. Ñandú, café y 🍷";
    const cifrado = encryptText(texto, "google-oauth2|123");
    assert.equal(decryptText(cifrado, "google-oauth2|123"), texto);
  });

  test("el texto cifrado no contiene el texto original", () => {
    const cifrado = encryptText("secreto de viaje", "user-1");
    assert.ok(!cifrado.includes("secreto"));
    assert.ok(!Buffer.from(cifrado, "base64").toString("utf8").includes("secreto"));
  });

  test("el mismo texto cifrado dos veces da resultados distintos (nonce aleatorio)", () => {
    const a = encryptText("hola", "user-1");
    const b = encryptText("hola", "user-1");
    assert.notEqual(a, b);
  });

  test("otro usuario no puede descifrar", () => {
    const cifrado = encryptText("privado", "user-1");
    assert.throws(() => decryptText(cifrado, "user-2"));
  });

  test("otra clave maestra no puede descifrar", () => {
    const cifrado = encryptText("privado", "user-1");
    process.env.DOCS_MASTER_KEY = KEY_B;
    assert.throws(() => decryptText(cifrado, "user-1"));
  });

  test("detecta un texto alterado", () => {
    const cifrado = encryptText("privado", "user-1");
    const bytes = Buffer.from(cifrado, "base64");
    bytes[bytes.length - 1] ^= 1; // cambia un bit
    assert.throws(() => decryptText(bytes.toString("base64"), "user-1"));
  });

  test("falla si falta la clave maestra", () => {
    delete process.env.DOCS_MASTER_KEY;
    assert.throws(() => encryptText("x", "user-1"), /DOCS_MASTER_KEY/);
  });

  test("falla si la clave maestra tiene formato inválido", () => {
    process.env.DOCS_MASTER_KEY = "corta";
    assert.throws(() => encryptText("x", "user-1"), /64 caracteres/);
  });

  test("falla si el texto cifrado es demasiado corto", () => {
    assert.throws(() => decryptText("abc", "user-1"), /inválido/);
  });
});
