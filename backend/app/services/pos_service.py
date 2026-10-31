from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.models.inventario import Kardex, Producto
from app.schemas.pos import VentaCreate
from app.services.cierre_caja_service import business_day, lock_day
from app.services.cierre_caja_service import MANAGUA, utc_naive_bounds
from app.services.inventario_service import InventarioService


CENT = Decimal("0.01")
DEFAULT_CARD_COMMISSION_PERCENT = Decimal("6.75")


class POSService:
    @staticmethod
    def list_sales(
        db: Session,
        start_date: date | None = None,
        end_date: date | None = None,
        brand_id: int | None = None,
        payment_method: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> dict:
        if start_date and end_date and start_date > end_date:
            raise HTTPException(status_code=422, detail="La fecha inicial no puede ser posterior a la final.")
        clauses = ["e.modulo = 'ventas'", "e.nombre = 'Facturada'"]
        params = {}
        if start_date:
            start_bound, _ = utc_naive_bounds(start_date, start_date + timedelta(days=1))
            clauses.append("v.fecha_venta >= :start_bound")
            params["start_bound"] = start_bound
        if end_date:
            _, end_bound = utc_naive_bounds(end_date, end_date + timedelta(days=1))
            clauses.append("v.fecha_venta < :end_bound")
            params["end_bound"] = end_bound
        if brand_id:
            clauses.append("EXISTS (SELECT 1 FROM venta_detalles x JOIN productos px ON px.id = x.producto_id WHERE x.venta_id = v.id AND px.marca_id = :brand_id)")
            params["brand_id"] = brand_id
        if payment_method:
            clauses.append("lower(trim(mp.metodo_pago)) = lower(trim(:payment_method))")
            params["payment_method"] = payment_method
        if search and search.strip():
            clauses.append("""(
                v.id::text ILIKE :search OR c.nombre_cliente ILIKE :search OR EXISTS (
                    SELECT 1 FROM venta_detalles sx JOIN productos sp ON sp.id = sx.producto_id
                    WHERE sx.venta_id = v.id AND (sp.nombre ILIKE :search OR COALESCE(sp.sku, '') ILIKE :search)
                )
            )""")
            params["search"] = f"%{search.strip()}%"
        where = " AND ".join(clauses)
        from_sql = """
            FROM ventas v
            JOIN estados e ON e.id = v.estado_id
            LEFT JOIN clientes c ON c.id = v.cliente_id
            LEFT JOIN metodo_pago mp ON mp.id = v.metodo_pago_id
        """
        summary = db.execute(text(f"""
            SELECT count(*) AS transacciones,
                   COALESCE(sum(v.total), 0) AS total_cobrado,
                   COALESCE(sum((SELECT COALESCE(sum(vd.subtotal), 0) FROM venta_detalles vd WHERE vd.venta_id = v.id)), 0) AS ventas_productos,
                   COALESCE(sum(v.comision_pos), 0) AS comision_pos
            {from_sql} WHERE {where}
        """), params).mappings().one()
        sales = db.execute(text(f"""
            SELECT v.id, v.fecha_venta, COALESCE(c.nombre_cliente, 'Consumidor Final') AS cliente,
                   COALESCE(mp.metodo_pago, 'Sin método') AS metodo_pago,
                   v.total, v.comision_pos,
                   (SELECT COALESCE(sum(vd.subtotal), 0) FROM venta_detalles vd WHERE vd.venta_id = v.id) AS subtotal
            {from_sql} WHERE {where}
            ORDER BY v.fecha_venta DESC, v.id DESC
            LIMIT :limit OFFSET :offset
        """), {**params, "limit": page_size, "offset": (page - 1) * page_size}).mappings().all()
        sale_ids = [row["id"] for row in sales]
        items_by_sale = {sale_id: [] for sale_id in sale_ids}
        if sale_ids:
            item_rows = db.execute(text("""
                SELECT vd.venta_id, vd.producto_id, p.nombre AS producto, p.sku,
                       m.id AS marca_id, m.nombre_marca AS marca,
                       vd.cantidad, vd.precio_unitario, vd.subtotal
                FROM venta_detalles vd
                JOIN productos p ON p.id = vd.producto_id
                JOIN marcas m ON m.id = p.marca_id
                WHERE vd.venta_id IN :sale_ids
                ORDER BY vd.venta_id, m.nombre_marca, p.nombre
            """).bindparams(bindparam("sale_ids", expanding=True)), {"sale_ids": sale_ids}).mappings().all()
            for item in item_rows:
                items_by_sale[item["venta_id"]].append({
                    "producto_id": item["producto_id"], "producto": item["producto"],
                    "sku": item["sku"], "marca_id": item["marca_id"], "marca": item["marca"],
                    "cantidad": item["cantidad"], "precio_unitario": item["precio_unitario"], "subtotal": item["subtotal"],
                })
        return {
            "pagina": page, "por_pagina": page_size, "total": int(summary["transacciones"]),
            "resumen": dict(summary),
            "ventas": [{
                "id": row["id"],
                "fecha_venta": row["fecha_venta"].replace(tzinfo=timezone.utc).astimezone(MANAGUA).isoformat() if row["fecha_venta"] else None,
                "cliente": row["cliente"], "metodo_pago": row["metodo_pago"],
                "total": row["total"], "subtotal": row["subtotal"], "comision_pos": row["comision_pos"],
                "unidades": sum(int(item["cantidad"]) for item in items_by_sale[row["id"]]),
                "marcas": sorted({item["marca"] for item in items_by_sale[row["id"]]}, key=str.casefold),
                "items": items_by_sale[row["id"]],
            } for row in sales],
        }

    @staticmethod
    def get_commission_config(db: Session) -> dict:
        value = db.execute(text("SELECT comision_tarjeta_porcentaje FROM pos_config WHERE id = 1")).scalar_one()
        return {"comision_tarjeta_porcentaje": value}

    @staticmethod
    def save_commission_config(db: Session, rate: Decimal) -> dict:
        value = db.execute(text("""
            UPDATE pos_config SET comision_tarjeta_porcentaje = :rate, actualizado_en = now()
            WHERE id = 1 RETURNING comision_tarjeta_porcentaje
        """), {"rate": rate}).scalar_one()
        db.commit()
        return {"comision_tarjeta_porcentaje": value}

    @staticmethod
    def create_sale(db: Session, sale_in: VentaCreate, user_id: int) -> dict:
        # Consolidate repeated scans of the same QR into one invoice line.
        quantities = {}
        for item in sale_in.items:
            quantities[item.producto_id] = quantities.get(item.producto_id, 0) + item.cantidad

        try:
            sale_day = business_day()
            lock_day(db, sale_day)
            if db.execute(
                text("SELECT 1 FROM cierres_caja WHERE fecha = :day AND (reabierta_en IS NULL OR reabierta_en <= cerrado_en)"), {"day": sale_day}
            ).first():
                raise ValueError("La caja de hoy ya fue cerrada. Las ventas se habilitarán mañana.")

            products = (
                db.query(Producto)
                .filter(Producto.id.in_(quantities.keys()))
                .order_by(Producto.id)
                .with_for_update()
                .all()
            )
            by_id = {product.id: product for product in products}
            missing = [product_id for product_id in quantities if product_id not in by_id]
            if missing:
                raise ValueError(f"No se encontraron los productos: {', '.join(map(str, missing))}")

            lines = []
            total = Decimal("0.00")
            for product_id, quantity in quantities.items():
                product = by_id[product_id]
                if product.estado_id != 1:
                    raise ValueError(f"El producto {product.sku} no está activo")
                stock = InventarioService.get_stock(db, product.id)
                if quantity > stock:
                    raise ValueError(f"Stock insuficiente para {product.nombre}: quedan {stock} unidades")
                unit_price = Decimal(str(product.precio or 0)).quantize(CENT, rounding=ROUND_HALF_UP)
                if unit_price <= 0:
                    raise ValueError(f"El producto {product.sku} no tiene un precio válido")
                line_total = (unit_price * quantity).quantize(CENT, rounding=ROUND_HALF_UP)
                lines.append({
                    "producto_id": product.id,
                    "sku": product.sku or "",
                    "nombre": product.nombre,
                    "cantidad": quantity,
                    "precio_unitario": unit_price,
                    "subtotal": line_total,
                })
                total += line_total

            payment = db.execute(
                text("SELECT id, metodo_pago FROM metodo_pago WHERE lower(metodo_pago) = lower(:method) LIMIT 1"),
                {"method": sale_in.metodo_pago.strip()},
            ).first()
            if not payment:
                raise ValueError("El método de pago seleccionado no está configurado")

            subtotal = total
            rate_percent = db.execute(text("SELECT comision_tarjeta_porcentaje FROM pos_config WHERE id = 1")).scalar_one()
            commission = (
                (subtotal * Decimal(str(rate_percent)) / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
                if payment.metodo_pago.strip().casefold() == "tarjeta"
                else Decimal("0.00")
            )
            # ponytail: la marca absorbe la comisión; el cliente solo paga el subtotal de productos.
            total = subtotal

            if sale_in.cliente_id:
                customer = db.execute(
                    text("SELECT id, nombre_cliente FROM clientes WHERE id = :id"),
                    {"id": sale_in.cliente_id},
                ).mappings().first()
                if not customer:
                    raise ValueError("El cliente seleccionado ya no existe")
                customer_id = customer["id"]
                customer_name = customer["nombre_cliente"]
            else:
                # ponytail: use one shared final-consumer record to honor the existing NOT NULL FK.
                customer_name = (sale_in.cliente or "").strip() or "Consumidor Final"
                customer_id = db.execute(
                    text("SELECT id FROM clientes WHERE lower(trim(nombre_cliente)) = lower(:name) ORDER BY id LIMIT 1"),
                    {"name": customer_name},
                ).scalar()
                if customer_id is None:
                    customer_id = db.execute(
                        text("INSERT INTO clientes (nombre_cliente) VALUES (:name) RETURNING id"),
                        {"name": customer_name},
                    ).scalar_one()

            invoice_state_id = db.execute(
                text("SELECT id FROM estados WHERE modulo = 'ventas' AND nombre = 'Facturada' ORDER BY id LIMIT 1")
            ).scalar()
            if invoice_state_id is None:
                raise ValueError("No está configurado el estado Facturada para ventas")

            sale_id = db.execute(
                text("""
                    INSERT INTO ventas (usuario_id, cliente_id, metodo_pago_id, total, comision_pos, estado_id)
                    VALUES (:user_id, :customer_id, :payment_id, :total, :commission, :state_id)
                    RETURNING id
                """),
                {
                    "user_id": user_id,
                    "customer_id": customer_id,
                    "payment_id": payment.id,
                    "total": total,
                    "commission": commission,
                    "state_id": invoice_state_id,
                },
            ).scalar_one()

            db.execute(
                text("""
                    INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal)
                    VALUES (:sale_id, :product_id, :quantity, :unit_price, 0, :subtotal)
                """),
                [
                    {
                        "sale_id": sale_id,
                        "product_id": line["producto_id"],
                        "quantity": line["cantidad"],
                        "unit_price": line["precio_unitario"],
                        "subtotal": line["subtotal"],
                    }
                    for line in lines
                ],
            )
            db.add_all([
                Kardex(
                    producto_id=line["producto_id"],
                    usuario_id=user_id,
                    tipo_movimiento="VENTA",
                    cantidad=line["cantidad"],
                    referencia_id=sale_id,
                    motivo=f"Factura #{sale_id}",
                )
                for line in lines
            ])
            db.execute(
                text("INSERT INTO pagos_venta (venta_id, metodo_pago, monto) VALUES (:sale_id, :method, :amount)"),
                {"sale_id": sale_id, "method": payment.metodo_pago, "amount": total},
            )
            db.flush()
            sale_date = db.execute(
                text("SELECT fecha_venta FROM ventas WHERE id = :sale_id"), {"sale_id": sale_id}
            ).scalar_one()
            db.commit()

            return {
                "id": sale_id,
                "fecha_venta": sale_date.isoformat() if sale_date else "",
                "cliente": customer_name,
                "metodo_pago": payment.metodo_pago,
                "subtotal": subtotal,
                "comision_pos": commission,
                "total": total,
                "items": lines,
            }
        except Exception:
            db.rollback()
            raise
