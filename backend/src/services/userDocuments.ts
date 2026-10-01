// src/services/userDocuments.ts
//
// Orquesta la subida de un documento de usuario para el RAG privado:
// valida -> registra en Postgres -> extrae texto -> divide en fragmentos ->
// calcula embeddings -> cifra -> guarda en Chroma -> marca como listo.
//
// El archivo original nunca se guarda en disco ni en storage (ver plan,
// Fase 0): se recibe como buffer en memoria y se descarta al terminar.

import path from "node:path";
import { extractTextFromBuffer } from "../rag/extract.js";
import { chunkText } from "../rag/chunk.js";
import { embed } from "../rag/embed.js";
import { addDocumentChunks, deleteDocumentChunks, type EncryptedChunk } from "../rag/userDocsChroma.js";
import { encryptText } from "../utils/textCrypto.js";
import { logStep } from "../utils/logger.js";
import {
  createDocument,
  markDocumentError,
  markDocumentReady,
  type UserDocument,
} from "../documents.js";
import { ALLOWED_DOC_EXTENSIONS, MAX_CHUNKS_PER_DOCUMENT, MAX_DOC_BYTES } from "../constans.js";

export type UploadValidationError =
  | "FORMATO_NO_PERMITIDO"
  | "ARCHIVO_DEMASIADO_GRANDE"
  | "ARCHIVO_VACIO";

export type UploadError = UploadValidationError | "LIMITE_DOCUMENTOS" | "SIN_TEXTO";

export class UploadDocumentError extends Error {
  constructor(public readonly code: UploadError) {
    super(code);
    this.name = "UploadDocumentError";
  }
}

/**
 * Valida el archivo antes de tocar la base de datos. La ruta HTTP (Paso 5)
 * también debería limitar el tamaño a nivel de multer/express, esto es una
 * segunda barrera por si se llama al servicio desde otro lado.
 */
export function validateUpload(filename: string, sizeBytes: number): void {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
    throw new UploadDocumentError("FORMATO_NO_PERMITIDO");
  }
  if (sizeBytes <= 0) {
    throw new UploadDocumentError("ARCHIVO_VACIO");
  }
  if (sizeBytes > MAX_DOC_BYTES) {
    throw new UploadDocumentError("ARCHIVO_DEMASIADO_GRANDE");
  }
}

/**
 * Procesa y guarda un documento subido por el usuario. Devuelve el registro
 * ya en estado "ready".
 *
 * Lanza UploadDocumentError si algo fue mal. Si el fallo ocurre después de
 * crear el registro en Postgres, este queda marcado como "error" (no se
 * borra), así el usuario ve en su lista que algo falló y puede reintentar
 * subiendo de nuevo.
 */
export async function processUserDocumentUpload(
  userId: string,
  filename: string,
  buffer: Buffer,
): Promise<UserDocument> {
  validateUpload(filename, buffer.byteLength);

  const document = await createDocument(userId, filename);
  if (!document) {
    throw new UploadDocumentError("LIMITE_DOCUMENTOS");
  }

  try {
    const rawText = await extractTextFromBuffer(buffer, filename);
    const chunks = chunkText(rawText, filename).slice(0, MAX_CHUNKS_PER_DOCUMENT);

    if (chunks.length === 0) {
      throw new UploadDocumentError("SIN_TEXTO");
    }

    logStep("services:userDocuments", "Procesando documento de usuario", {
      documentId: document.id,
      filename,
      chunks: chunks.length,
    });

    const encryptedChunks: EncryptedChunk[] = [];
    for (const chunk of chunks) {
      const vector = await embed(chunk.content, "RETRIEVAL_DOCUMENT");
      encryptedChunks.push({
        index: chunk.index,
        vector,
        encryptedContent: encryptText(chunk.content, userId),
      });
    }

    await addDocumentChunks(userId, document.id, document.expiresAt, encryptedChunks);
    await markDocumentReady(userId, document.id, encryptedChunks.length);

    return { ...document, status: "ready", chunkCount: encryptedChunks.length };
  } catch (error) {
    logStep("services:userDocuments", "Error procesando documento, revirtiendo", {
      documentId: document.id,
      error: error instanceof Error ? error.message : String(error),
    });
    // Por si ya se llegó a guardar algo en Chroma antes del fallo.
    await deleteDocumentChunks(userId, document.id).catch(() => {});
    await markDocumentError(userId, document.id);

    if (error instanceof UploadDocumentError) throw error;
    throw error;
  }
}
