BEGIN;

ALTER TABLE public.cierres_caja
  ADD COLUMN IF NOT EXISTS reabierta_en timestamp without time zone,
  ADD COLUMN IF NOT EXISTS reabierta_por integer REFERENCES public.usuarios(id);

COMMIT;
