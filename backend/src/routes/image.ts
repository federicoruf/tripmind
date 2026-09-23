// routes/image.ts
import dotenv from "dotenv";
dotenv.config();

import { Router, Request, Response } from "express";
import { checkJwt } from "../middleware/auth";
import { logStep, logError } from "../utils/logger";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "../constans";
import { identifyPlace } from "../services/imageIdentifier";

const router = Router();

router.post("/identify", checkJwt, async (req: Request, res: Response) => {
  const userId = req.auth?.payload.sub as string;
  const { imageBase64, mimeType } = req.body;

  if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
    res.status(400).json({ error: "El campo 'imageBase64' es requerido." });
    return;
  }

  if (typeof mimeType !== "string" || !ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    res.status(400).json({
      error: `Tipo de imagen no soportado. Permitidos: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}.`,
    });
    return;
  }

  // Tamaño real del archivo a partir del string base64 (sin decodificarlo).
  const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    res.status(400).json({
      error: `La imagen supera el máximo permitido (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB).`,
    });
    return;
  }

  logStep("route:image", "Petición de identificación recibida", { userId, mimeType });

  try {
    const resultado = await identifyPlace(imageBase64, mimeType, userId);
    res.json(resultado);
  } catch (err) {
    logError("route:image", "Error identificando imagen", err);
    res.status(500).json({ error: "No se pudo procesar la imagen. Intentá de nuevo." });
  }
});

export default router;
