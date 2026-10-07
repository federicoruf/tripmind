// routes/internal.ts
//
// Endpoints internos, pensados para ser llamados por Cloud Scheduler (no por
// el frontend). No usan el token de Auth0: se protegen con un secreto propio
// (CRON_SECRET) enviado en el header `x-cron-secret`.

import { createHash, timingSafeEqual } from "node:crypto";
import { Router, Request, Response, NextFunction } from "express";
import { cleanupExpiredDocuments } from "../services/cleanupExpiredDocuments";
import { logError, logWarn } from "../utils/logger";

const router = Router();

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Falla cerrada: sin secreto configurado el endpoint no funciona.
    logError("routes:internal", "CRON_SECRET no está configurado");
    return res.status(503).json({ error: "Endpoint no disponible" });
  }

  const received = req.header("x-cron-secret") ?? "";
  // Se comparan los hashes (largo fijo) con timingSafeEqual para no filtrar
  // información por tiempos de respuesta.
  const ok = timingSafeEqual(sha256(received), sha256(expected));
  if (!ok) {
    logWarn("routes:internal", "Intento de acceso con secreto inválido");
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

router.post("/cleanup", requireCronSecret, async (_req: Request, res: Response) => {
  try {
    const result = await cleanupExpiredDocuments();
    // Si algo falló devolvemos 500 para que Cloud Scheduler lo marque como
    // fallido y reintente; los borrados que sí funcionaron no se repiten.
    return res.status(result.failed > 0 ? 500 : 200).json(result);
  } catch (err) {
    logError("routes:internal", "Error en /cleanup", err);
    return res.status(500).json({ error: "Error en la limpieza" });
  }
});

export default router;
