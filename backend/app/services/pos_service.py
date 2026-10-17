from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.inventario import Kardex, Producto
from app.schemas.pos import VentaCreate
from app.services.inventario_service import InventarioService


CENT = Decimal("0.01")


class POSService:
    @staticmethod
    def create_sale(db: Session, sale_in: VentaCreate, user_id: int) -> dict:
        # Consolidate repeated scans of the same QR into one invoice line.
        quantities = {}
        for item in sale_in.items:
            quantities[item.producto_id] = quantities.get(item.producto_id, 0) + item.cantidad

        try:
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

            customer_name = sale_in.cliente.strip() or "Consumidor Final"
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
                    VALUES (:user_id, :customer_id, :payment_id, :total, 0, :state_id)
                    RETURNING id
                """),
                {
                    "user_id": user_id,
                    "customer_id": customer_id,
                    "payment_id": payment.id,
                    "total": total,
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
                "total": total,
                "items": lines,
            }
        except Exception:
            db.rollback()
            raise
