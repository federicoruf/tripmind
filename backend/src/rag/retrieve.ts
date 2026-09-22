// src/rag/retrieve.ts
import { ChromaClient, type EmbeddingFunction } from "chromadb";

import { embed } from "./embed.js";
import { getChromaClient } from "./chromaClient.js";
import { logStep, previewTexto } from "../utils/logger";

const COLLECTION_NAME = "tripmind_guides";

// Distancia máxima aceptada (depende de la métrica de tu colección,
// por defecto Chroma usa L2 — ajustá este valor probando con tus datos reales)
const DEFAULT_MAX_DISTANCE = 0.5;

class NoopEmbeddingFunction implements EmbeddingFunction {
  async generate(_texts: string[]): Promise<number[][]> {
    throw new Error(
      "No debería llamarse: los vectores se generan a mano con Gemini.",
    );
  }
}

export interface RetrievedChunk {
  content: string;
  source: string;
  distance: number;
}

export async function retrieveContext(
  query: string,
  options: { topK?: number; maxDistance?: number } = {},
): Promise<RetrievedChunk[]> {
  const { topK = 4, maxDistance = DEFAULT_MAX_DISTANCE } = options;
  const client = getChromaClient();
  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: new NoopEmbeddingFunction(),
    metadata: { "hnsw:space": "cosine" },
  });

  const queryVector = await embed(query, "RETRIEVAL_QUERY");

  const results = await collection.query({
    queryEmbeddings: [queryVector],
    nResults: topK*2,
    include: ["documents", "metadatas", "distances"] as any,
  });

  const documents = results.documents[0] ?? [];
  const metadatas = results.metadatas[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  if (process.env.DEBUG_RAG === "true") {
    logStep("rag:retrieve", "Distancias crudas de los candidatos (antes de filtrar)", {
      maxDistance,
      candidatos: distances.map((d, i) => ({
        source: metadatas[i]?.source ?? "desconocido",
        distance: typeof d === "number" ? Number(d.toFixed(4)) : d,
      })),
    });
  }

  const seen = new Set<string>();
  const chunks: RetrievedChunk[] = [];

  for (let i = 0; i < documents.length; i++) {
    const content = (documents[i] ?? "").trim();
    const distance = distances[i] ?? Infinity;
    const source = (metadatas[i]?.source as string) ?? "desconocido";

    if (!content) continue;

    // Filtro por umbral de similitud
    if (distance > maxDistance) continue;

    // Deduplicación (exacta, normalizando espacios)
    const key = content.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    chunks.push({ content, source, distance });

    if (chunks.length >= topK) break;
  }

  if (process.env.DEBUG_RAG === "true") {
    logStep("rag:retrieve", "Búsqueda semántica resuelta", {
      query: previewTexto(query),
      chunksRetenidos: chunks.length,
      candidatos: documents.length,
    });
    chunks.forEach((c, i) =>
      logStep("rag:retrieve", `Chunk ${i}`, {
        fuente: c.source,
        distancia: Number(c.distance.toFixed(4)),
        preview: c.content.slice(0, 60),
      }),
    );
  }

  return chunks;
}