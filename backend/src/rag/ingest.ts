// src/rag/ingest.ts
import path from "path";
import fs from "fs/promises";
import { ChromaClient, type EmbeddingFunction } from "chromadb";
import { extractText } from "./extract.js";
import { chunkText } from "./chunk.js";
import { embed } from "./embed.js";

const DOCS_DIR = path.resolve("src/rag/docs");
const COLLECTION_NAME = "tripmind_guides";

class NoopEmbeddingFunction implements EmbeddingFunction {
  async generate(_texts: string[]): Promise<number[][]> {
    throw new Error("No debería llamarse: los vectores se generan a mano con Gemini.");
  }
}

async function ingest() {
  const chroma = new ChromaClient({ host: "localhost", port: 8000, ssl: false });
  const collection = await chroma.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: new NoopEmbeddingFunction(), //
  });

  const files = await fs.readdir(DOCS_DIR);

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    const rawText = await extractText(filePath);
    const chunks = chunkText(rawText, file);

    console.log(`${file}: ${chunks.length} chunks`);

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

  console.log("Ingesta completa.");
}

ingest();
