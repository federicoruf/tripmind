// src/rag/routes.ts
import { Router } from "express";
import multer from "multer";
import { extractText } from "./extract.js";
import { chunkText } from "./chunk.js";
import { embed } from "./embed.js";
import { getCollection } from "./chroma.js"; // la lógica de conexión, refactorizada

const upload = multer({ dest: "uploads/" });
const router = Router();

router.post("/documents", upload.single("file"), async (req, res) => {
  const userId = req.user.id; // asumiendo que ya tenés auth
  const filePath = req.file!.path;

  const rawText = await extractText(filePath);
  const chunks = chunkText(rawText, req.file!.originalname);
  const collection = await getCollection();

  for (const chunk of chunks) {
    const vector = await embed(chunk.content);
    await collection.add({
      ids: [`${userId}-${req.file!.originalname}-${chunk.index}`],
      embeddings: [vector],
      documents: [chunk.content],
      metadatas: [{ source: chunk.source, userId }], // clave: separar por usuario
    });
  }

  res.json({ chunksCreated: chunks.length });
});

export default router;