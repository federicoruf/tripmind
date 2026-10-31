-- 003_user_memory.sql
--
-- Tabla de memoria de preferencias de usuario.
-- Ejecutar UNA VEZ en cada base (Neon dev y prod).
--
-- Notas:
-- - Guarda el resumen de memoria de preferencias de viaje para cada usuario.
-- - gen_random_uuid() viene incluido desde PostgreSQL 13.
-- - user_id es la clave primaria (un usuario = una memoria).

CREATE TABLE IF NOT EXISTS user_memory (
  user_id      TEXT PRIMARY KEY,
  resumen_texto TEXT        NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
