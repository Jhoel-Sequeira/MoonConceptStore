BEGIN;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date;

COMMIT;
