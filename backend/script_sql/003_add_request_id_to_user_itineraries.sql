-- 003_add_request_id_to_user_itineraries.sql
--
-- Añade la columna request_id a la tabla user_itineraries para deduplicar guardados.
-- Cada solicitud de generación del usuario tendrá un request_id único.
-- Esto permite que múltiples reintentos del orchestrador actualicen el mismo
-- registro en vez de crear nuevos.
--
-- Ejecutar UNA VEZ en cada base (Neon dev y prod).

-- Añadir columna request_id (nullable para no romper datos existentes)
ALTER TABLE user_itineraries ADD COLUMN IF NOT EXISTS request_id UUID;

-- Crear indice en request_id para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_user_itineraries_request_id 
  ON user_itineraries (request_id);

-- Añadir constraint para que request_id + user_id sea único (opcional, pero recomendado)
-- Esto garantiza que un request_id solo se use una vez por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_itineraries_request_id_user_id 
  ON user_itineraries (request_id, user_id) 
  WHERE request_id IS NOT NULL;
