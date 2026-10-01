// utils/textCrypto.ts
//
// Cifrado del texto de los fragmentos (chunks) que suben los usuarios,
// antes de guardarlos en Chroma. AES-256-GCM (cifra y verifica integridad).
//
// - DOCS_MASTER_KEY: clave maestra de 32 bytes en hexadecimal (64 caracteres).
//   Generar una con:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// - La clave de cada usuario se DERIVA de la maestra + su userId (HKDF),
//   así no hay que guardar una clave por usuario.
// - Cada texto usa un nonce aleatorio distinto.
// - Formato guardado (base64): nonce (12 bytes) + tag (16 bytes) + texto cifrado.
//
// Si se pierde DOCS_MASTER_KEY, los textos guardados ya no se pueden leer.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
// Valor fijo: separa el uso de esta clave de otros posibles usos futuros.
const HKDF_SALT = "tripmind-user-docs-v1";

function getMasterKey(): Buffer {
  const hex = process.env.DOCS_MASTER_KEY;
  if (!hex) {
    throw new Error("Falta la variable de entorno DOCS_MASTER_KEY");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "DOCS_MASTER_KEY debe ser un hexadecimal de 64 caracteres (32 bytes)",
    );
  }
  return Buffer.from(hex, "hex");
}

function deriveUserKey(userId: string): Buffer {
  if (!userId) {
    throw new Error("userId es obligatorio para cifrar/descifrar");
  }
  const key = hkdfSync("sha256", getMasterKey(), HKDF_SALT, userId, KEY_BYTES);
  return Buffer.from(key);
}

/** Cifra un texto para un usuario. Devuelve un string en base64. */
export function encryptText(plainText: string, userId: string): string {
  const key = deriveUserKey(userId);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, encrypted]).toString("base64");
}

/**
 * Descifra un texto de un usuario.
 * Lanza error si la clave no corresponde (otro usuario) o si el dato fue alterado.
 */
export function decryptText(encoded: string, userId: string): string {
  const key = deriveUserKey(userId);
  const data = Buffer.from(encoded, "base64");
  if (data.length < NONCE_BYTES + TAG_BYTES) {
    throw new Error("Texto cifrado inválido");
  }
  const nonce = data.subarray(0, NONCE_BYTES);
  const tag = data.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
  const encrypted = data.subarray(NONCE_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
