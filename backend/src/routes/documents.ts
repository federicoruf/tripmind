// routes/documents.ts
//
// Endpoints para que el usuario suba, liste y borre sus documentos del RAG
// privado. Todos protegidos con checkJwt: el userId siempre sale del token,
// nunca del body ni de la URL, así un usuario no puede leer ni borrar
// documentos de otro.
//
// El archivo se recibe en base64 dentro del JSON (mismo patrón que
// routes/image.ts), no como multipart. index.ts le da a esta ruta un límite
// de body mayor al default, para que quepan los 10MB permitidos.

import { Router, Request, Response } from "express";
import { checkJwt } from "../middleware/auth";
import { logStep, logError } from "../utils/logger";
import { MAX_DOC_BYTES, ALLOWED_DOC_EXTENSIONS } from "../constans";
import {
  processUserDocumentUpload,
  UploadDocumentError,
  type UploadError,
} from "../services/userDocuments";
import { deleteDocumentChunks } from "../rag/userDocsChroma";
import { deleteUserDocument, getUserDocument, listUserDocuments } from "../documents";

const router = Router();

// Mensajes en español para cada código de error de validación/negocio.
// Se separan del texto técnico (logs) para poder mostrarlos tal cual en el frontend.
const ERROR_MESSAGES: Record<UploadError, string> = {
  FORMATO_NO_PERMITIDO: `Formato no permitido. Solo se aceptan: ${ALLOWED_DOC_EXTENSIONS.join(", ")}.`,
  ARCHIVO_DEMASIADO_GRANDE: `El archivo supera el máximo permitido (${Math.round(MAX_DOC_BYTES / 1024 / 1024)}MB).`,
  ARCHIVO_VACIO: "El archivo está vacío.",
  LIMITE_DOCUMENTOS: "Ya alcanzaste el máximo de documentos permitidos. Borrá alguno para subir otro.",
  SIN_TEXTO: "No se pudo extraer texto del archivo (¿está vacío o es una imagen escaneada?).",
};

router.post("/upload", checkJwt, async (req: Request, res: Response) => {
  const userId = req.auth?.payload.sub as string;
  const { filename, fileBase64 } = req.body;

  if (typeof filename !== "string" || !filename.trim()) {
    res.status(400).json({ error: "El campo 'filename' es requerido." });
    return;
  }
  if (typeof fileBase64 !== "string" || !fileBase64.trim()) {
    res.status(400).json({ error: "El campo 'fileBase64' es requerido." });
    return;
  }

  // Tamaño aproximado antes de decodificar, igual que en routes/image.ts.
  const approxBytes = Math.ceil((fileBase64.length * 3) / 4);
  if (approxBytes > MAX_DOC_BYTES) {
    res.status(400).json({ error: ERROR_MESSAGES.ARCHIVO_DEMASIADO_GRANDE });
    return;
  }

  logStep("route:documents", "Subida de documento recibida", { userId });

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    const document = await processUserDocumentUpload(userId, filename, buffer);

    logStep("route:documents", "Documento procesado", {
      userId,
      documentId: document.id,
      chunks: document.chunkCount,
    });

    res.status(201).json({
      id: document.id,
      filename: document.filename,
      status: document.status,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt,
      expiresAt: document.expiresAt,
    });
  } catch (err) {
    if (err instanceof UploadDocumentError) {
      res.status(400).json({ error: ERROR_MESSAGES[err.code] });
      return;
    }
    logError("route:documents", "Error procesando documento", err);
    res.status(500).json({ error: "No se pudo procesar el documento. Intentá de nuevo." });
  }
});

router.get("/", checkJwt, async (req: Request, res: Response) => {
  const userId = req.auth?.payload.sub as string;

  try {
    const documents = await listUserDocuments(userId);
    res.json(documents);
  } catch (err) {
    logError("route:documents", "Error listando documentos", err);
    res.status(500).json({ error: "No se pudieron listar los documentos." });
  }
});

router.delete("/:id", checkJwt, async (req: Request, res: Response) => {
  const userId = req.auth?.payload.sub as string;
  const id = req.params.id as string;

  try {
    // Se verifica que el documento sea del usuario ANTES de borrar nada,
    // así se puede devolver 404 sin tocar Chroma ni Postgres.
    const document = await getUserDocument(userId, id);
    if (!document) {
      res.status(404).json({ error: "Documento no encontrado." });
      return;
    }

    await deleteDocumentChunks(userId, id);
    await deleteUserDocument(userId, id);

    logStep("route:documents", "Documento borrado", { userId, documentId: id });
    res.status(204).send();
  } catch (err) {
    logError("route:documents", "Error borrando documento", err);
    res.status(500).json({ error: "No se pudo borrar el documento." });
  }
});

export default router;
