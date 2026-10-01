// src/rag/retrieveUserDocs.ts
//
// Búsqueda semántica en los documentos privados del usuario (RAG privado),
// paralela a retrieveContext (que busca en las guías públicas).
//
// El texto guardado en Chroma está cifrado (ver services/userDocuments.ts);
// acá se descifra SOLO lo que efectivamente se recupera para esta consulta
// puntual, nunca la colección entera.

import { type EmbeddingFunction } from "chromadb";
import { getChromaClient } from "./chromaClient.js";
import { embed } from "./embed.js";
import { USER_DOCS_COLLECTION_NAME } from "./userDocsChroma.js";
import { type RetrievedChunk } from "./retrieve";
import { decryptText } from "../utils/textCrypto";
import { getUserDocumentFilenames } from "../documents";
import { logStep, previewTexto } from "../utils/logger";
import { DEFAULT_MAX_DISTANCE } from "../constans";

class NoopEmbeddingFunction implements EmbeddingFunction {
  async generate(_texts: string[]): Promise<number[][]> {
    throw new Error("No debería llamarse: los vectores se generan a mano con Gemini.");
  }
}

async function getCollection() {
  const client = getChromaClient();
  return client.getOrCreateCollection({
    name: USER_DOCS_COLLECTION_NAME,
    embeddingFunction: new NoopEmbeddingFunction(),
    metadata: { "hnsw:space": "cosine" },
  });
}

/**
 * Busca fragmentos de los documentos del propio usuario relevantes para
 * `query`. Devuelve el mismo tipo que retrieveContext (RetrievedChunk) para
 * que promptBuilder pueda mezclar ambos resultados sin distinguir el origen.
 *
 * El filtro `where` hace dos cosas a la vez: aísla los datos por usuario
 * (nunca se ven fragmentos de otro) e ignora documentos ya vencidos, como
 * segundo seguro además del job de limpieza del Paso 8.
 */
export async function retrieveUserContext(
  userId: string,
  query: string,
  options: { topK?: number; maxDistance?: number } = {},
): Promise<RetrievedChunk[]> {
  const { topK = 4, maxDistance = DEFAULT_MAX_DISTANCE } = options;

  const collection = await getCollection();
  const queryVector = await embed(query, "RETRIEVAL_QUERY");

  const results = await collection.query({
    queryEmbeddings: [queryVector],
    nResults: topK * 2,
    where: {
      $and: [{ user_id: { $eq: userId } }, { expires_at: { $gt: Date.now() } }],
    },
    include: ["documents", "metadatas", "distances"] as any,
  });

  const documents = results.documents[0] ?? [];
  const metadatas = results.metadatas[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  interface Candidato {
    content: string;
    distance: number;
    documentId: string;
  }
  const candidatos: Candidato[] = [];

  for (let i = 0; i < documents.length; i++) {
    const encrypted = documents[i];
    const distance = distances[i] ?? Infinity;
    const documentId = (metadatas[i]?.document_id as string | undefined) ?? null;

    if (!encrypted || !documentId) continue;
    if (distance > maxDistance) continue;

    let content: string;
    try {
      content = decryptText(encrypted, userId).trim();
    } catch (err) {
      // No debería pasar salvo corrupción de datos o rotación de la clave
      // maestra sin migración; se descarta el fragmento en vez de tirar
      // abajo todo el itinerario por un solo chunk ilegible.
      logStep("rag:retrieveUserDocs", "No se pudo descifrar un fragmento, se descarta", {
        userId,
        documentId,
      });
      continue;
    }
    if (!content) continue;

    candidatos.push({ content, distance, documentId });
    if (candidatos.length >= topK) break;
  }

  if (candidatos.length === 0) return [];

  // El nombre del archivo vive en Postgres,
  // así que se resuelve acá en una sola consulta por los ids
  // encontrados, no uno por fragmento.
  const uniqueIds = [...new Set(candidatos.map((c) => c.documentId))];
  const filenames = await getUserDocumentFilenames(userId, uniqueIds);

  const chunks: RetrievedChunk[] = candidatos.map((c) => ({
    content: c.content,
    distance: c.distance,
    source: `Tu documento: ${filenames[c.documentId] ?? "documento subido"}`,
  }));

  if (process.env.DEBUG_RAG === "true") {
    // Ojo: a propósito NO se loguea el contenido de estos fragmentos (son
    // privados del usuario), a diferencia de retrieveContext que sí muestra
    // preview de las guías públicas.
    logStep("rag:retrieveUserDocs", "Búsqueda en documentos de usuario resuelta", {
      userId,
      query: previewTexto(query),
      chunksRetenidos: chunks.length,
      fuentes: chunks.map((c) => c.source),
    });
  }

  return chunks;
}