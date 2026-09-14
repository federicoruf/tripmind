// src/rag/embed.ts
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();


const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function embed(text: string, taskType: EmbedTaskType): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: text,
    config: { taskType },
  });

  return response.embeddings![0].values!;
}