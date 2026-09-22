// src/rag/ingest.ts
import path from "path";
import fs from "fs/promises";
import { type EmbeddingFunction } from "chromadb";
import { getChromaClient } from "./chromaClient.js";
import { extractText } from "./extract.js";
import { chunkText } from "./chunk.js";
import { embed } from "./embed.js";
import { logStep } from "../utils/logger.js";

const DOCS_DIR = path.resolve("src/rag/docs");
const COLLECTION_NAME = "tripmind_guides";

class NoopEmbeddingFunction implements EmbeddingFunction {
  async generate(_texts: string[]): Promise<number[][]> {
    throw new Error("No debería llamarse: los vectores se generan a mano con Gemini.");
  }
}

async function ingest() {
  const chroma = getChromaClient();
  const collection = await chroma.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: new NoopEmbeddingFunction(), //
    // Coseno explícito, para que coincida con retrieve.ts. Si no se
    // especifica acá, Chroma usa L2² por defecto — y como el espacio de
    // una colección se fija al crearla, poner "cosine" del lado de
    // retrieve.ts no sirve de nada si la colección ya se creó sin esto.
    metadata: { "hnsw:space": "cosine" },
  });

  const files = await fs.readdir(DOCS_DIR);

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    const rawText = await extractText(filePath);
    const chunks = chunkText(rawText, file);

    logStep("rag:ingest", `Procesando ${file}`, { chunks: chunks.length });

    for (const chunk of chunks) {
      const vector = await embed(chunk.content, "RETRIEVAL_DOCUMENT");
      await collection.add({
        ids: [`${file}-${chunk.index}`],
        embeddings: [vector],
        documents: [chunk.content],
        metadatas: [{ source: chunk.source }],
      });
    }
  }

  logStep("rag:ingest", "Ingesta completa");
}

ingest();