// routes/itineraryHistory.ts
//
// Endpoints para el historial de itinerarios del usuario.
// Todos protegidos con checkJwt: el userId siempre sale del token,
// nunca del body ni de la URL, asi un usuario no puede leer ni borrar
// itinerarios de otro.

import { Router, Request, Response } from "express";
import { checkJwt } from "../middleware/auth";
import { logStep, logError } from "../utils/logger";
import {
  listItineraries,
  getItinerary,
  deleteItinerary,
  type ItineraryHistoryListItem,
  type ItineraryHistoryDetail,
} from "../services/itineraryHistory";

const router = Router();

/**
 * Lista los itinerarios guardados del usuario (no vencidos).
 * GET /api/itinerary/history
 */
router.get("/", checkJwt, async (req: Request, res: Response) => {
  const userId = req.auth?.payload.sub as string;

  try {
    const itineraries: ItineraryHistoryListItem[] = await listItineraries(userId);
    res.json({ itineraries, count: itineraries.length });
  } catch (err) {
    logError("route:itineraryHistory", "Error listando itinerarios", err);
    res.status(500).json({ error: "No se pudieron listar los itinerarios." });
  }
});

/**
 * Obtiene un itinerario especifica del usuario.
 * GET /api/itinerary/history/:id
 */
router.get("/:id", checkJwt, async (req: Request, res: Response) => {
  const userId = req.auth?.payload.sub as string;
  const id = req.params.id as string;

  try {
    const itinerary: ItineraryHistoryDetail | null = await getItinerary(
      userId,
      id,
    );

    if (!itinerary) {
      // 404 para: no encontrado, vencido, o de otro usuario (sin filtrar info)
      res.status(404).json({ error: "Itinerario no encontrado." });
      return;
    }

    res.json(itinerary);
  } catch (err) {
    logError("route:itineraryHistory", "Error obteniendo itinerario", err);
    res.status(500).json({ error: "No se pudo obtener el itinerario." });
  }
});

/**
 * Elimina un itinerario del usuario.
 * DELETE /api/itinerary/history/:id
 */
router.delete("/:id", checkJwt, async (req: Request, res: Response) => {
  const userId = req.auth?.payload.sub as string;
  const id = req.params.id as string;

  try {
    const deleted = await deleteItinerary(userId, id);

    if (!deleted) {
      // 404 para: no encontrado, vencido, o de otro usuario (sin filtrar info)
      res.status(404).json({ error: "Itinerario no encontrado." });
      return;
    }

    logStep("route:itineraryHistory", "Itinerario eliminado", { userId, itineraryId: id });
    res.status(204).send();
  } catch (err) {
    logError("route:itineraryHistory", "Error eliminando itinerario", err);
    res.status(500).json({ error: "No se pudo eliminar el itinerario." });
  }
});

export default router;
