BEGIN;

ALTER TABLE productos
ADD COLUMN IF NOT EXISTS detalles_rubro jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
