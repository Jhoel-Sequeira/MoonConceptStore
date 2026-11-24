ALTER TABLE public.liquidacion_detalles
  ADD COLUMN IF NOT EXISTS monto_cuenta_marca numeric(12,2) NOT NULL DEFAULT 0;
