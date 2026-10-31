-- 002_user_itineraries.sql
--
-- Tabla de itinerarios generados guardados por los usuarios.
-- Ejecutar UNA VEZ en cada base (Neon dev y prod).
--
-- Notas:
-- - Guarda metadatos del itinerario (prompt, summary) en texto plano.
-- - El JSON del itinerario completo se guarda cifrado en la columna itinerary_json.
-- - gen_random_uuid() viene incluido desde PostgreSQL 13.
-- - Cada usuario puede tener max 10 itinerarios no vencidos.
-- - Los itinerarios vencen a los 30 dias de su creacion.

CREATE TABLE IF NOT EXISTS user_itineraries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT        NOT NULL,
  prompt        TEXT        NOT NULL,
  summary       TEXT        NOT NULL,
  itinerary_json TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

-- Listar itinerarios de un usuario, ordenados por mas reciente primero
CREATE INDEX IF NOT EXISTS idx_user_itineraries_user_id_created_at
  ON user_itineraries (user_id, created_at DESC);

-- Job de limpieza: buscar itinerarios vencidos
CREATE INDEX IF NOT EXISTS idx_user_itineraries_expires_at
  ON user_itineraries (expires_at);
