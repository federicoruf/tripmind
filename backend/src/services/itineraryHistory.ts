// src/services/itineraryHistory.ts
//
// Servicio para gestionar el historial de itinerarios generados por los usuarios.
// Incluye guardado automatico con cifrado, listado, obtenicion, eliminacion,
// y aplicacion del limite de 10 itinerarios por usuario.

import { pool } from "../db";
import { encryptText, decryptText } from "../utils/textCrypto";
import { logStep, logError, logWarn } from "../utils/logger";
import {
  MAX_ITINERARIES_PER_USER,
  ITINERARY_RETENTION_DAYS,
} from "../constans";

// Tipos para los datos del historial
export interface ItineraryHistoryItem {
  id: string;
  userId: string;
  prompt: string;
  summary: string;
  itineraryJson: string; // JSON cifrado
  createdAt: Date;
  expiresAt: Date;
}

// DTO para el listado (sin el JSON cifrado)
export interface ItineraryHistoryListItem {
  id: string;
  prompt: string;
  summary: string;
  createdAt: Date;
  expiresAt: Date;
}

// DTO para el detalle (con el itinerario descifrado)
export interface ItineraryHistoryDetail {
  id: string;
  prompt: string;
  summary: string;
  itinerary: any; // JSON del itinerario descifrado y parseado
  createdAt: Date;
  expiresAt: Date;
}

// Mapeo de fila de base de datos a ItineraryHistoryItem
function mapRow(row: any): ItineraryHistoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    prompt: row.prompt,
    summary: row.summary,
    itineraryJson: row.itinerary_json,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Guarda un itinerario generado para un usuario.
 * - Valida que el JSON del itinerario sea valido
 * - Cifra el JSON con la clave del usuario
 * - Aplica el limite de MAX_ITINERARIES_PER_USER
 * - Usa requestId para deduplicar: si ya existe un itinerario con el mismo requestId,
 *   lo actualiza en vez de crear uno nuevo (para evitar duplicados por reintentos del orchestrador)
 * - Usa transaccion con SELECT FOR UPDATE para evitar races
 * 
 * @param userId - Auth0 subject claim
 * @param prompt - Prompt original del usuario
 * @param summary - Resumen generado (max 500 chars)
 * @param itineraryJson - JSON del itinerario validado
 * @param requestId - UUID único por solicitud de generación (opcional). Si se proporciona,
 *                   se usa para deduplicar: solo un itinerario por requestId por usuario.
 * @returns El item guardado o null si no se pudo guardar (limite alcanzado)
 */
export async function saveItinerary(
  userId: string,
  prompt: string,
  summary: string,
  itineraryJson: string,
  requestId?: string,
): Promise<ItineraryHistoryItem | null> {
  const encryptedItinerary = encryptText(itineraryJson, userId);

  // Transaccion para: insertar/actualizar + eliminar el mas viejo si supera el limite
  // Usamos SELECT FOR UPDATE para bloquear las filas del usuario y evitar races
  // La clave es bloquear TODAS las filas del usuario ANTES de insertar/actualizar
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloquear TODAS las filas del usuario (incluyendo las que vamos a eliminar)
    // Esto previene que otros procesos inserten mientras nosotros contamos
    await client.query(
      `SELECT id FROM user_itineraries
       WHERE user_id = $1 AND expires_at > now()
       FOR UPDATE`,
      [userId],
    );

    let newItem: ItineraryHistoryItem;

    // Si tenemos requestId, verificar si ya existe un itinerario con ese requestId
    if (requestId) {
      // Buscar itinerario existente con el mismo requestId
      const existingResult = await client.query(
        `SELECT * FROM user_itineraries
         WHERE user_id = $1 AND request_id = $2 AND expires_at > now()`,
        [userId, requestId],
      );

      if (existingResult.rows.length > 0) {
        // Actualizar el itinerario existente
        const updateResult = await client.query(
          `UPDATE user_itineraries
           SET prompt = $2, summary = $3, itinerary_json = $4, created_at = now(), expires_at = now() + make_interval(days => $5::int)
           WHERE id = $1
           RETURNING *`,
          [existingResult.rows[0].id, prompt, summary, encryptedItinerary, ITINERARY_RETENTION_DAYS],
        );

        if (updateResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return null;
        }

        newItem = mapRow(updateResult.rows[0]);
        logStep("services:itineraryHistory", "Itinerario actualizado (mismo requestId)", {
          userId,
          itineraryId: newItem.id,
          requestId,
        });
      } else {
        // Insertar nuevo itinerario con requestId
        const insertResult = await client.query(
          `INSERT INTO user_itineraries
           (user_id, request_id, prompt, summary, itinerary_json, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, now(), now() + make_interval(days => $6::int))
           RETURNING *`,
          [userId, requestId, prompt, summary, encryptedItinerary, ITINERARY_RETENTION_DAYS],
        );

        if (insertResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return null;
        }

        newItem = mapRow(insertResult.rows[0]);
        logStep("services:itineraryHistory", "Itinerario guardado con requestId", {
          userId,
          itineraryId: newItem.id,
          requestId,
        });
      }
    } else {
      // Insertar sin requestId (comportamiento legado)
      const insertResult = await client.query(
        `INSERT INTO user_itineraries
         (user_id, prompt, summary, itinerary_json, created_at, expires_at)
         VALUES ($1, $2, $3, $4, now(), now() + make_interval(days => $5::int))
         RETURNING *`,
        [userId, prompt, summary, encryptedItinerary, ITINERARY_RETENTION_DAYS],
      );

      if (insertResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      newItem = mapRow(insertResult.rows[0]);
      logStep("services:itineraryHistory", "Itinerario guardado (sin requestId)", {
        userId,
        itineraryId: newItem.id,
      });
    }

    // Ahora contar cuántos no vencidos tiene el usuario (incluyendo el nuevo/actualizado)
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM user_itineraries
       WHERE user_id = $1 AND expires_at > now()`,
      [userId],
    );

    const currentCount = countResult.rows[0].total;

    // Si excede el limite, eliminar el mas viejo
    if (currentCount > MAX_ITINERARIES_PER_USER) {
      // Eliminar el itinerario mas viejo (no vencido) del usuario
      await client.query(
        `DELETE FROM user_itineraries
         WHERE id IN (
           SELECT id FROM user_itineraries
           WHERE user_id = $1 AND expires_at > now()
           ORDER BY created_at ASC
           LIMIT 1
         )`,
        [userId],
      );
    }

    await client.query("COMMIT");

    logStep("services:itineraryHistory", "Transaccion completada", {
      userId,
      itineraryId: newItem.id,
      count: currentCount,
    });

    return newItem;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    logError("services:itineraryHistory", "Error guardando itinerario", error);
    // No relanzar el error: el guardado no debe romper la generacion
    return null;
  } finally {
    client.release();
  }
}

/**
 * Lista los itinerarios guardados de un usuario (no vencidos), ordenados por mas reciente.
 */
export async function listItineraries(
  userId: string,
): Promise<ItineraryHistoryListItem[]> {
  const result = await pool.query(
    `SELECT id, prompt, summary, created_at, expires_at
     FROM user_itineraries
     WHERE user_id = $1 AND expires_at > now()
     ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    summary: row.summary,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Obtiene un itinerario especifico de un usuario, con el JSON descifrado.
 * 
 * @param userId - Auth0 subject claim
 * @param itineraryId - ID del itinerario
 * @returns El item con el itinerario descifrado o null si no existe/pertenece a otro usuario/esta vencido
 */
export async function getItinerary(
  userId: string,
  itineraryId: string,
): Promise<ItineraryHistoryDetail | null> {
  const result = await pool.query(
    `SELECT id, prompt, summary, itinerary_json, created_at, expires_at
     FROM user_itineraries
     WHERE id = $1 AND user_id = $2 AND expires_at > now()`,
    [itineraryId, userId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  try {
    const decryptedJson = decryptText(row.itinerary_json, userId);
    const itinerary = JSON.parse(decryptedJson);

    return {
      id: row.id,
      prompt: row.prompt,
      summary: row.summary,
      itinerary,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  } catch (error) {
    logError("services:itineraryHistory", "Error descifrando itinerario", error);
    // Si falla el descifrado, tratar como no encontrado (no filtrar info)
    return null;
  }
}

/**
 * Elimina un itinerario de un usuario.
 * 
 * @param userId - Auth0 subject claim
 * @param itineraryId - ID del itinerario a eliminar
 * @returns true si se elimino, false si no existia/pertenecia a otro usuario/esta vencido
 */
export async function deleteItinerary(
  userId: string,
  itineraryId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM user_itineraries
     WHERE id = $1 AND user_id = $2 AND expires_at > now()`,
    [itineraryId, userId],
  );

  const deleted = (result.rowCount ?? 0) > 0;
  
  if (deleted) {
    logStep("services:itineraryHistory", "Itinerario eliminado", {
      userId,
      itineraryId,
    });
  }

  return deleted;
}

/**
 * Lista los itinerarios vencidos para el job de limpieza.
 */
export async function listExpiredItineraries(): Promise<
  { id: string; userId: string }[]
> {
  const result = await pool.query(
    `SELECT id, user_id FROM user_itineraries WHERE expires_at <= now()`,
  );
  return result.rows.map((r) => ({ id: r.id, userId: r.user_id }));
}

/**
 * Elimina un itinerario por ID (para el job de limpieza, sin validar usuario).
 */
export async function deleteItineraryById(itineraryId: string): Promise<void> {
  await pool.query(`DELETE FROM user_itineraries WHERE id = $1`, [itineraryId]);
}
