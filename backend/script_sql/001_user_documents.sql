-- 001_user_documents.sql
--
-- Tabla de documentos subidos por los usuarios (RAG privado).
-- Ejecutar UNA VEZ en cada base (Development y Production en Railway).
--
-- Notas:
-- - El archivo original NO se guarda; solo este registro (metadatos).
-- - El texto de los fragmentos vive cifrado en Chroma, no acá.
-- - gen_random_uuid() viene incluido desde PostgreSQL 13.

CREATE TABLE IF NOT EXISTS user_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        NOT NULL,
  filename     TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'processing'
               CHECK (status IN ('processing', 'ready', 'error')),
  chunk_count  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);

-- Listar / contar documentos de un usuario
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id
  ON user_documents (user_id);

-- Job de limpieza: buscar documentos vencidos
CREATE INDEX IF NOT EXISTS idx_user_documents_expires_at
  ON user_documents (expires_at);
