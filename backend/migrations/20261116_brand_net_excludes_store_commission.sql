-- Remove the former 20% store commission from unsettled brand payouts.
UPDATE public.liquidaciones l
SET total_comision_tienda = 0,
    total_neto_pagar = l.total_bruto - l.total_comision_pos
FROM public.estados e
WHERE e.id = l.estado_id
  AND e.modulo = 'liquidaciones'
  AND e.nombre = 'Pendiente';

UPDATE public.liquidacion_detalles d
SET comision_tienda = 0,
    subtotal_neto = COALESCE(d.monto_efectivo, 0)
                  + COALESCE(d.monto_tarjeta, 0)
                  + COALESCE(d.monto_transferencia, 0)
                  - COALESCE(d.comision_pos, 0)
FROM public.liquidaciones l
JOIN public.estados e ON e.id = l.estado_id
WHERE d.liquidacion_id = l.id
  AND e.modulo = 'liquidaciones'
  AND e.nombre = 'Pendiente';
