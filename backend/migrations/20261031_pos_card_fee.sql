BEGIN;

CREATE TABLE IF NOT EXISTS public.pos_config (
  -- ponytail: one constrained row keeps the rate global until the business needs per-brand rates.
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  comision_tarjeta_porcentaje numeric(5,2) NOT NULL DEFAULT 6.75
    CHECK (comision_tarjeta_porcentaje >= 0 AND comision_tarjeta_porcentaje <= 100),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.pos_config (id, comision_tarjeta_porcentaje)
VALUES (1, 6.75)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.pos_config ENABLE ROW LEVEL SECURITY;

COMMIT;
