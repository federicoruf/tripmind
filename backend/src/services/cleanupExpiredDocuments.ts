// services/cleanupExpiredDocuments.ts
//
// Job de limpieza (Paso 8): borra los documentos de usuario cuyo `expires_at`
// ya pasó. Orden por documento: primero los fragmentos en Chroma y recién
// después el registro en Postgres. Si Chroma falla, el registro se conserva a
// propósito: así el documento sigue figurando como vencido y el próximo
// pasada del job lo reintenta (si se borrara primero Postgres, quedarían
// fragmentos huérfanos en Chroma que nadie volvería a buscar).
//
// Solo se loguean contadores, nunca nombres de archivo ni contenido.

import { deleteDocumentById, listExpiredDocuments } from "../documents";
import { deleteDocumentChunks } from "../rag/userDocsChroma";
import { listExpiredItineraries, deleteItineraryById } from "./itineraryHistory";
import { logStep, logWarn } from "../utils/logger";

export interface CleanupResult {
  found: number;
  deleted: number;
  failed: number;
}

export async function cleanupExpiredDocuments(): Promise<CleanupResult> {
  const expiredDocs = await listExpiredDocuments();
  const expiredItineraries = await listExpiredItineraries();
  let deleted = 0;
  let failed = 0;

  // Limpiar documentos de usuario
  for (const { id, userId } of expiredDocs) {
    try {
      await deleteDocumentChunks(userId, id);
      await deleteDocumentById(id);
      deleted++;
    } catch (err) {
      failed++;
      // Solo el id del documento y el tipo de error; sin contenido.
      logWarn("services:cleanup", "No se pudo borrar un documento vencido", {
        documentId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Limpiar itinerarios
  for (const { id, userId } of expiredItineraries) {
    try {
      await deleteItineraryById(id);
      deleted++;
    } catch (err) {
      failed++;
      // Solo el id del itinerario y el tipo de error; sin contenido.
      logWarn("services:cleanup", "No se pudo borrar un itinerario vencido", {
        itineraryId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const result = { found: expiredDocs.length + expiredItineraries.length, deleted, failed };
  logStep("services:cleanup", "Limpieza de documentos e itinerarios vencidos finalizada", result);
  return result;
}
