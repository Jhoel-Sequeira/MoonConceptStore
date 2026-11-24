BEGIN;

-- Keep existing invoice states and return rows as they are; only permit new return events.
ALTER TABLE public.devoluciones_venta DROP CONSTRAINT devoluciones_venta_venta_id_key;
ALTER TABLE public.devoluciones_venta_detalles DROP CONSTRAINT devoluciones_venta_detalles_venta_detalle_id_key;
ALTER TABLE public.devoluciones_venta_detalles
  ADD CONSTRAINT devoluciones_venta_detalles_devolucion_venta_detalle_key UNIQUE (devolucion_id, venta_detalle_id);

DROP FUNCTION internal.registrar_devolucion_venta(integer, text, integer);

CREATE FUNCTION internal.registrar_devolucion_venta(
  p_venta_id integer,
  p_motivo text,
  p_lineas jsonb,
  p_usuario_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, internal
AS $$
DECLARE
  v_estado text;
  v_metodo_pago varchar(100);
  v_venta_total numeric(12, 2);
  v_pago_total numeric(12, 2);
  v_devolucion_id bigint;
  v_total numeric(12, 2) := 0;
  v_requested_count integer;
  v_distinct_count integer;
  v_found_count integer;
  v_line record;
  v_prepared jsonb := '[]'::jsonb;
  v_monto_linea numeric(12, 2);
BEGIN
  IF p_venta_id IS NULL OR p_venta_id <= 0 THEN RAISE EXCEPTION 'Número de factura inválido'; END IF;
  IF p_usuario_id IS NULL OR p_usuario_id <= 0 THEN RAISE EXCEPTION 'Usuario inválido'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN RAISE EXCEPTION 'El motivo debe tener al menos 5 caracteres'; END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' THEN RAISE EXCEPTION 'La lista de productos no es válida'; END IF;
  IF jsonb_array_length(p_lineas) = 0 THEN RAISE EXCEPTION 'Selecciona al menos un producto'; END IF;

  SELECT count(*), count(DISTINCT x.venta_detalle_id)
  INTO v_requested_count, v_distinct_count
  FROM jsonb_to_recordset(p_lineas) AS x(venta_detalle_id integer, cantidad integer);
  IF v_requested_count <> v_distinct_count THEN RAISE EXCEPTION 'No repitas productos en una devolución'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_lineas) AS x(venta_detalle_id integer, cantidad integer)
    WHERE x.venta_detalle_id IS NULL OR x.venta_detalle_id <= 0 OR x.cantidad IS NULL OR x.cantidad <= 0
  ) THEN RAISE EXCEPTION 'Las cantidades devueltas deben ser mayores que cero'; END IF;

  SELECT e.nombre, mp.metodo_pago, v.total
  INTO v_estado, v_metodo_pago, v_venta_total
  FROM public.ventas v
  JOIN public.estados e ON e.id = v.estado_id AND e.modulo = 'ventas'
  JOIN public.metodo_pago mp ON mp.id = v.metodo_pago_id
  WHERE v.id = p_venta_id
  FOR UPDATE OF v;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe la factura %', p_venta_id; END IF;
  IF v_estado <> 'Facturada' THEN RAISE EXCEPTION 'La factura % no está disponible para devolución', p_venta_id; END IF;

  SELECT COALESCE(sum(p.monto), 0)::numeric(12, 2) INTO v_pago_total
  FROM public.pagos_venta p WHERE p.venta_id = p_venta_id;
  IF v_pago_total <> v_venta_total THEN
    RAISE EXCEPTION 'Los pagos registrados (%) no coinciden con el total de la factura (%)', v_pago_total, v_venta_total;
  END IF;

  SELECT count(*) INTO v_found_count
  FROM jsonb_to_recordset(p_lineas) AS x(venta_detalle_id integer, cantidad integer)
  JOIN public.venta_detalles vd ON vd.id = x.venta_detalle_id AND vd.venta_id = p_venta_id;
  IF v_found_count <> v_requested_count THEN RAISE EXCEPTION 'Uno o más productos no pertenecen a la factura'; END IF;

  PERFORM vd.id
  FROM public.venta_detalles vd
  JOIN jsonb_to_recordset(p_lineas) AS x(venta_detalle_id integer, cantidad integer) ON x.venta_detalle_id = vd.id
  WHERE vd.venta_id = p_venta_id
  ORDER BY vd.id
  FOR UPDATE OF vd;
  PERFORM p.id
  FROM public.productos p
  JOIN public.venta_detalles vd ON vd.producto_id = p.id
  JOIN jsonb_to_recordset(p_lineas) AS x(venta_detalle_id integer, cantidad integer) ON x.venta_detalle_id = vd.id
  WHERE vd.venta_id = p_venta_id
  ORDER BY p.id
  FOR UPDATE OF p;

  FOR v_line IN
    SELECT x.venta_detalle_id, x.cantidad AS cantidad_solicitada,
           vd.producto_id, vd.cantidad AS cantidad_vendida, vd.subtotal,
           COALESCE(sum(d.cantidad), 0)::integer AS cantidad_devuelta,
           COALESCE(sum(d.monto_devuelto), 0)::numeric(12, 2) AS monto_devuelto
    FROM jsonb_to_recordset(p_lineas) AS x(venta_detalle_id integer, cantidad integer)
    JOIN public.venta_detalles vd ON vd.id = x.venta_detalle_id AND vd.venta_id = p_venta_id
    LEFT JOIN public.devoluciones_venta_detalles d ON d.venta_detalle_id = vd.id
    GROUP BY x.venta_detalle_id, x.cantidad, vd.producto_id, vd.cantidad, vd.subtotal
    ORDER BY vd.id
  LOOP
    IF v_line.cantidad_solicitada > v_line.cantidad_vendida - v_line.cantidad_devuelta THEN
      RAISE EXCEPTION 'La cantidad a devolver supera las unidades restantes del producto %', v_line.producto_id;
    END IF;
    IF v_line.cantidad_solicitada = v_line.cantidad_vendida - v_line.cantidad_devuelta THEN
      v_monto_linea := v_line.subtotal - v_line.monto_devuelto;
    ELSE
      v_monto_linea := round(v_line.subtotal * v_line.cantidad_solicitada / v_line.cantidad_vendida, 2);
    END IF;
    v_total := v_total + v_monto_linea;
    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'venta_detalle_id', v_line.venta_detalle_id,
      'producto_id', v_line.producto_id,
      'cantidad', v_line.cantidad_solicitada,
      'monto_devuelto', v_monto_linea
    ));
  END LOOP;

  INSERT INTO public.devoluciones_venta
    (venta_id, motivo, monto_reembolso, metodo_reembolso, registrado_por)
  VALUES (p_venta_id, trim(p_motivo), v_total, v_metodo_pago, p_usuario_id)
  RETURNING id INTO v_devolucion_id;

  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(v_prepared)
      AS x(venta_detalle_id integer, producto_id integer, cantidad integer, monto_devuelto numeric)
  LOOP
    INSERT INTO public.devoluciones_venta_detalles
      (devolucion_id, venta_detalle_id, producto_id, cantidad, monto_devuelto)
    VALUES (v_devolucion_id, v_line.venta_detalle_id, v_line.producto_id, v_line.cantidad, v_line.monto_devuelto);
    INSERT INTO public.kardex
      (producto_id, usuario_id, tipo_movimiento, cantidad, referencia_id, motivo)
    VALUES (v_line.producto_id, p_usuario_id, 'AJUSTE_POSITIVO', v_line.cantidad, p_venta_id,
      format('Devolución de factura #%s: %s', p_venta_id, trim(p_motivo)));
  END LOOP;

  RETURN jsonb_build_object(
    'devolucion_id', v_devolucion_id,
    'venta_id', p_venta_id,
    'monto_reembolso', v_total,
    'metodo_reembolso', v_metodo_pago,
    'estado_reembolso', 'Pendiente',
    'lineas', v_prepared
  );
END;
$$;

REVOKE ALL ON FUNCTION internal.registrar_devolucion_venta(integer, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.registrar_devolucion_venta(integer, text, jsonb, integer) TO service_role;

CREATE OR REPLACE VIEW internal.devoluciones_detalle AS
SELECT r.id AS devolucion_id, r.venta_id, r.fecha_devolucion, r.metodo_reembolso,
       r.estado_reembolso, d.venta_detalle_id, d.producto_id, p.marca_id,
       d.cantidad, d.monto_devuelto
FROM public.devoluciones_venta r
JOIN public.devoluciones_venta_detalles d ON d.devolucion_id=r.id
JOIN public.productos p ON p.id=d.producto_id;
GRANT SELECT ON internal.devoluciones_detalle TO service_role;

COMMIT;
