BEGIN;

ALTER TABLE public.devoluciones_venta
  ADD COLUMN registrado_por integer REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN reembolso_registrado_por integer REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN reembolso_referencia varchar(120);

ALTER TABLE public.devoluciones_venta
  ADD CONSTRAINT devoluciones_venta_reembolso_audit_check
  CHECK (
    (estado_reembolso = 'Pendiente' AND reembolsado_en IS NULL AND reembolso_registrado_por IS NULL AND reembolso_referencia IS NULL)
    OR
    (estado_reembolso = 'Reembolsado' AND reembolsado_en IS NOT NULL AND reembolso_registrado_por IS NOT NULL AND length(trim(reembolso_referencia)) >= 3)
  );

DROP FUNCTION internal.registrar_devolucion_venta(integer, text);

CREATE FUNCTION internal.registrar_devolucion_venta(p_venta_id integer, p_motivo text, p_usuario_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, internal
AS $$
DECLARE
  v_total numeric(12, 2);
  v_estado text;
  v_metodo_pago varchar(100);
  v_pago_total numeric(12, 2);
  v_estado_anulada_id integer;
  v_devolucion_id bigint;
  v_line record;
BEGIN
  IF p_venta_id IS NULL OR p_venta_id <= 0 THEN RAISE EXCEPTION 'Número de factura inválido'; END IF;
  IF p_usuario_id IS NULL OR p_usuario_id <= 0 THEN RAISE EXCEPTION 'Usuario inválido'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN RAISE EXCEPTION 'El motivo debe tener al menos 5 caracteres'; END IF;

  SELECT v.total, e.nombre, mp.metodo_pago
    INTO v_total, v_estado, v_metodo_pago
  FROM public.ventas v
  JOIN public.estados e ON e.id = v.estado_id AND e.modulo = 'ventas'
  JOIN public.metodo_pago mp ON mp.id = v.metodo_pago_id
  WHERE v.id = p_venta_id
  FOR UPDATE OF v;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe la factura %', p_venta_id; END IF;
  IF v_estado <> 'Facturada' THEN RAISE EXCEPTION 'La factura % no está Facturada (estado actual: %)', p_venta_id, v_estado; END IF;

  SELECT COALESCE(sum(p.monto), 0)::numeric(12, 2) INTO v_pago_total
  FROM public.pagos_venta p WHERE p.venta_id = p_venta_id;
  IF v_pago_total <> v_total THEN RAISE EXCEPTION 'Los pagos registrados (%) no coinciden con el total de la factura (%)', v_pago_total, v_total; END IF;

  PERFORM p.id FROM public.productos p
  JOIN public.venta_detalles vd ON vd.producto_id = p.id
  WHERE vd.venta_id = p_venta_id ORDER BY p.id FOR UPDATE OF p;

  SELECT id INTO v_estado_anulada_id FROM public.estados
  WHERE modulo = 'ventas' AND nombre = 'Anulada' ORDER BY id LIMIT 1;
  IF v_estado_anulada_id IS NULL THEN RAISE EXCEPTION 'No está configurado el estado Anulada para ventas'; END IF;

  INSERT INTO public.devoluciones_venta
    (venta_id, motivo, monto_reembolso, metodo_reembolso, registrado_por)
  VALUES (p_venta_id, trim(p_motivo), v_total, v_metodo_pago, p_usuario_id)
  RETURNING id INTO v_devolucion_id;

  FOR v_line IN
    SELECT vd.id, vd.producto_id, vd.cantidad, vd.subtotal
    FROM public.venta_detalles vd WHERE vd.venta_id = p_venta_id ORDER BY vd.producto_id, vd.id
  LOOP
    INSERT INTO public.devoluciones_venta_detalles
      (devolucion_id, venta_detalle_id, producto_id, cantidad, monto_devuelto)
    VALUES (v_devolucion_id, v_line.id, v_line.producto_id, v_line.cantidad, v_line.subtotal);
    INSERT INTO public.kardex
      (producto_id, usuario_id, tipo_movimiento, cantidad, referencia_id, motivo)
    VALUES (v_line.producto_id, p_usuario_id, 'AJUSTE_POSITIVO', v_line.cantidad,
      p_venta_id, format('Devolución de factura #%s: %s', p_venta_id, trim(p_motivo)));
  END LOOP;

  UPDATE public.ventas SET estado_id = v_estado_anulada_id WHERE id = p_venta_id;
  RETURN jsonb_build_object('devolucion_id', v_devolucion_id, 'venta_id', p_venta_id,
    'monto_reembolso', v_total, 'metodo_reembolso', v_metodo_pago, 'estado_reembolso', 'Pendiente');
END;
$$;

CREATE FUNCTION internal.confirmar_reembolso(p_devolucion_id bigint, p_referencia text, p_usuario_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, internal
AS $$
DECLARE
  v_row public.devoluciones_venta%ROWTYPE;
BEGIN
  IF p_devolucion_id IS NULL OR p_devolucion_id <= 0 THEN RAISE EXCEPTION 'Devolución inválida'; END IF;
  IF p_usuario_id IS NULL OR p_usuario_id <= 0 THEN RAISE EXCEPTION 'Usuario inválido'; END IF;
  IF p_referencia IS NULL OR length(trim(p_referencia)) < 3 OR length(trim(p_referencia)) > 120 THEN
    RAISE EXCEPTION 'La referencia debe tener entre 3 y 120 caracteres';
  END IF;

  SELECT * INTO v_row FROM public.devoluciones_venta WHERE id = p_devolucion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe la devolución %', p_devolucion_id; END IF;
  IF v_row.estado_reembolso <> 'Pendiente' THEN RAISE EXCEPTION 'El reembolso ya fue confirmado'; END IF;

  UPDATE public.devoluciones_venta
  SET estado_reembolso = 'Reembolsado', reembolsado_en = CURRENT_TIMESTAMP,
      reembolso_registrado_por = p_usuario_id, reembolso_referencia = trim(p_referencia)
  WHERE id = p_devolucion_id;

  RETURN jsonb_build_object('devolucion_id', p_devolucion_id, 'venta_id', v_row.venta_id,
    'monto_reembolso', v_row.monto_reembolso, 'estado_reembolso', 'Reembolsado',
    'reembolsado_en', CURRENT_TIMESTAMP, 'referencia', trim(p_referencia));
END;
$$;

REVOKE ALL ON FUNCTION internal.registrar_devolucion_venta(integer, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.confirmar_reembolso(bigint, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.registrar_devolucion_venta(integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION internal.confirmar_reembolso(bigint, text, integer) TO service_role;

COMMIT;
