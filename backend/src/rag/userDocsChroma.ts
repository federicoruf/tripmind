// src/rag/userDocsChroma.ts
//
// Colección de Chroma para los documentos que suben los usuarios (RAG
// privado), separada de "tripmind_guides" (las guías públicas).
//
// Diferencias clave respecto a ingest.ts / retrieve.ts:
// - El texto que se guarda en `documents` va CIFRADO (ver utils/textCrypto.ts).
//   Chroma solo ve caracteres ilegibles.
// - Cada fragmento lleva metadata `user_id`, `document_id` y `expires_at`
//   (timestamp en milisegundos) para poder filtrar por usuario y por
//   vencimiento.

import { type EmbeddingFunction } from "chromadb";
import { getChromaClient } from "./chromaClient.js";
import { logStep } from "../utils/logger.js";

export const USER_DOCS_COLLECTION_NAME = "tripmind_user_docs";

class NoopEmbeddingFunction implements EmbeddingFunction {
  async generate(_texts: string[]): Promise<number[][]> {
    throw new Error("No debería llamarse: los vectores se generan a mano con Gemini.");
  }
}

export interface EncryptedChunk {
  index: number;
  vector: number[];
  encryptedContent: string;
}

async function getCollection() {
  const chroma = getChromaClient();
  // Coseno explícito, igual que tripmind_guides (ver nota en ingest.ts:
  // el espacio de la colección se fija al crearla).
  return chroma.getOrCreateCollection({
    name: USER_DOCS_COLLECTION_NAME,
    embeddingFunction: new NoopEmbeddingFunction(),
    metadata: { "hnsw:space": "cosine" },
  });
}

/**
 * Guarda los fragmentos (ya cifrados) de un documento de usuario.
 * El id de cada fragmento es `${documentId}-${index}`, así deleteDocumentChunks
 * puede borrarlos filtrando por document_id sin necesidad de conocerlos.
 */
export async function addDocumentChunks(
  userId: string,
  documentId: string,
  expiresAt: Date,
  chunks: EncryptedChunk[],
): Promise<void> {
  if (chunks.length === 0) return;

  const collection = await getCollection();
  const expiresAtMs = expiresAt.getTime();

  await collection.add({
    ids: chunks.map((c) => `${documentId}-${c.index}`),
    embeddings: chunks.map((c) => c.vector),
    documents: chunks.map((c) => c.encryptedContent),
    metadatas: chunks.map(() => ({
      user_id: userId,
      document_id: documentId,
      expires_at: expiresAtMs,
    })),
  });

  logStep("rag:userDocsChroma", "Fragmentos guardados", {
    documentId,
    chunks: chunks.length,
  });
}

/**
 * Borra todos los fragmentos de un documento. Se usa al borrar un documento
 * (Paso 5) y en el job de limpieza por vencimiento (Paso 8).
 *
 * Nota: `where` filtra por document_id Y user_id, así un documentId no
 * puede usarse para borrar fragmentos de otro usuario aunque se conozca su id.
 */
export async function deleteDocumentChunks(userId: string, documentId: string): Promise<void> {
  const collection = await getCollection();
  await collection.delete({
    where: {
      $and: [{ document_id: { $eq: documentId } }, { user_id: { $eq: userId } }],
    },
  });
  logStep("rag:userDocsChroma", "Fragmentos borrados", { documentId });
}
