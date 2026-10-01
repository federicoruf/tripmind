// documents.ts
//
// Acceso a la tabla `user_documents` (registro de los documentos que sube
// cada usuario para el RAG privado). Mismo estilo que memory.ts.
//
// Importante: casi todas las funciones reciben `userId` (sacado del token de
// Auth0, nunca del frontend) y lo incluyen en el WHERE, así un usuario jamás
// puede leer ni borrar documentos de otro.

import { pool } from "./db";

export const MAX_DOCS_PER_USER = 5;
export const RETENTION_DAYS = 30;

export type DocumentStatus = "processing" | "ready" | "error";

export interface UserDocument {
  id: string;
  userId: string;
  filename: string;
  status: DocumentStatus;
  chunkCount: number;
  createdAt: Date;
  expiresAt: Date;
}

function mapRow(row: any): UserDocument {
  return {
    id: row.id,
    userId: row.user_id,
    filename: row.filename,
    status: row.status,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Crea el registro con estado "processing" y vencimiento a RETENTION_DAYS días.
 * Devuelve null si el usuario ya alcanzó el máximo de documentos
 * (el chequeo y el insert van en una sola query).
 */
export async function createDocument(
  userId: string,
  filename: string,
): Promise<UserDocument | null> {
  const result = await pool.query(
    `INSERT INTO user_documents (user_id, filename, status, expires_at)
     SELECT $1, $2, 'processing', now() + make_interval(days => $3::int)
     WHERE (
       SELECT COUNT(*) FROM user_documents
       WHERE user_id = $1 AND expires_at > now()
     ) < $4
     RETURNING *`,
    [userId, filename, RETENTION_DAYS, MAX_DOCS_PER_USER],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/** Cantidad de documentos vigentes (no vencidos) del usuario. */
export async function countUserDocuments(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM user_documents
     WHERE user_id = $1 AND expires_at > now()`,
    [userId],
  );
  return result.rows[0].total;
}

/** Lista los documentos vigentes del usuario, del más nuevo al más viejo. */
export async function listUserDocuments(userId: string): Promise<UserDocument[]> {
  const result = await pool.query(
    `SELECT * FROM user_documents
     WHERE user_id = $1 AND expires_at > now()
     ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(mapRow);
}

/** Devuelve un documento solo si pertenece al usuario. */
export async function getUserDocument(
  userId: string,
  documentId: string,
): Promise<UserDocument | null> {
  const result = await pool.query(
    `SELECT * FROM user_documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function markDocumentReady(
  userId: string,
  documentId: string,
  chunkCount: number,
): Promise<void> {
  await pool.query(
    `UPDATE user_documents
     SET status = 'ready', chunk_count = $3
     WHERE id = $1 AND user_id = $2`,
    [documentId, userId, chunkCount],
  );
}

export async function markDocumentError(
  userId: string,
  documentId: string,
): Promise<void> {
  await pool.query(
    `UPDATE user_documents SET status = 'error'
     WHERE id = $1 AND user_id = $2`,
    [documentId, userId],
  );
}

/**
 * Borra el registro solo si pertenece al usuario.
 * Devuelve true si existía. (Los fragmentos de Chroma se borran aparte.)
 */
export async function deleteUserDocument(
  userId: string,
  documentId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM user_documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Para el job de limpieza: documentos cuyo vencimiento ya pasó. */
export async function listExpiredDocuments(): Promise<
  { id: string; userId: string }[]
> {
  const result = await pool.query(
    `SELECT id, user_id FROM user_documents WHERE expires_at <= now()`,
  );
  return result.rows.map((r) => ({ id: r.id, userId: r.user_id }));
}

/** Para el job de limpieza (no depende de un usuario). */
export async function deleteDocumentById(documentId: string): Promise<void> {
  await pool.query(`DELETE FROM user_documents WHERE id = $1`, [documentId]);
}

/**
 * Nombres de archivo de un conjunto de documentos, filtrando siempre por
 * dueño. Se usa al armar el contexto RAG (Paso 6) para mostrar
 * "Tu documento: nombre.pdf" en vez del id interno, con una sola consulta
 * en lugar de una por fragmento recuperado.
 */
export async function getUserDocumentFilenames(
  userId: string,
  documentIds: string[],
): Promise<Record<string, string>> {
  if (documentIds.length === 0) return {};
  const result = await pool.query(
    `SELECT id, filename FROM user_documents WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, documentIds],
  );
  const filenames: Record<string, string> = {};
  for (const row of result.rows) filenames[row.id] = row.filename;
  return filenames;
}
