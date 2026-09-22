// src/rag/chromaClient.ts
import { ChromaClient, CloudClient } from "chromadb";
import { logStep } from "../utils/logger";

/**
 * Devuelve el cliente de Chroma correcto según el entorno.
 * - Si CHROMA_API_KEY está seteada, usa Chroma Cloud.
 * - Si no, asume un Chroma local (docker/python) en localhost:8000.
 *
 * Esto permite usar `npm run dev` local sin Chroma Cloud,
 * y en producción (Cloud Run) apuntar a Chroma Cloud solo con env vars.
 */
export function getChromaClient() {
  if (process.env.CHROMA_API_KEY) {
    logStep("rag:chromaClient", "Conectando a Chroma Cloud", {
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE,
    });
    return new CloudClient({
      apiKey: process.env.CHROMA_API_KEY,
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE,
    });
  }

  logStep("rag:chromaClient", "CHROMA_API_KEY no está seteada, conectando a Chroma LOCAL (localhost:8000)");
  return new ChromaClient({ host: "localhost", port: 8000, ssl: false });
}