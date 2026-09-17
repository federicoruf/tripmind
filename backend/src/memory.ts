// memory.ts
import { pool } from './db';

export async function getMemory(userId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT resumen_texto FROM user_memory WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.resumen_texto ?? null;
}

export async function saveMemory(userId: string, resumen: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_memory (user_id, resumen_texto, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id)
     DO UPDATE SET resumen_texto = $2, updated_at = now()`,
    [userId, resumen]
  );
}