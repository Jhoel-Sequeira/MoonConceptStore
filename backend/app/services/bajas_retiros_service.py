from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.bajas_retiros import DetalleRetiro, Retiro
from app.models.inventario import Kardex, Producto
from app.models.marcas import Estado, Marca
from app.models.usuarios import Usuario
from app.schemas.bajas_retiros import RetiroCreate
from app.services.inventario_service import InventarioService


class BajasRetirosService:
    @staticmethod
    def get_all(db: Session) -> list[dict]:
        retiros = (
            db.query(Retiro, Marca.nombre_marca, Usuario.nombre, Estado.nombre)
            .join(Marca, Marca.id == Retiro.marca_id)
            .join(Usuario, Usuario.id == Retiro.usuario_id)
            .join(Estado, Estado.id == Retiro.estado_id)
            .order_by(Retiro.fecha_retiro.desc(), Retiro.id.desc())
            .all()
        )
        if not retiros:
            return []

        retiro_ids = [row[0].id for row in retiros]
        totals = (
            db.query(
                DetalleRetiro.retiro_id,
                func.count(DetalleRetiro.detalle_id),
                func.coalesce(func.sum(DetalleRetiro.cantidad), 0),
            )
            .filter(DetalleRetiro.retiro_id.in_(retiro_ids))
            .group_by(DetalleRetiro.retiro_id)
            .all()
        )
        totals_by_id = {row[0]: (int(row[1]), int(row[2])) for row in totals}

        results = []
        for retiro, brand_name, user_name, status_name in retiros:
            item_count, units = totals_by_id.get(retiro.id, (0, 0))
            results.append({
                "id": f"RET-{retiro.id:06d}",
                "retiro_id": retiro.id,
                "marca_id": retiro.marca_id,
                "marca": brand_name,
                "fecha": retiro.fecha_retiro.isoformat() if retiro.fecha_retiro else None,
                "motivo": retiro.motivo,
                "items": item_count,
                "unidades": units,
                "solicitado_por": user_name,
                "estado": status_name,
            })
        return results

    @staticmethod
    def get_detail(db: Session, retiro_id: int) -> dict | None:
        row = (
            db.query(Retiro, Marca.nombre_marca, Usuario.nombre, Estado.nombre)
            .join(Marca, Marca.id == Retiro.marca_id)
            .join(Usuario, Usuario.id == Retiro.usuario_id)
            .join(Estado, Estado.id == Retiro.estado_id)
            .filter(Retiro.id == retiro_id)
            .first()
        )
        if not row:
            return None

        retiro, brand_name, user_name, status_name = row
        detail_rows = (
            db.query(DetalleRetiro, Producto)
            .join(Producto, Producto.id == DetalleRetiro.producto_id)
            .filter(DetalleRetiro.retiro_id == retiro.id)
            .order_by(DetalleRetiro.detalle_id)
            .all()
        )
        productos = [{
            "id": product.id,
            "sku": product.sku,
            "nombre": product.nombre,
            "descripcion": product.descripcion,
            "tamano": product.tamano,
            "cantidad": int(detail.cantidad),
            "precio": float(product.precio or 0),
            "imagen_url": product.imagen_url,
            "codigo_qr": product.codigo_qr,
        } for detail, product in detail_rows]

        return {
            "id": f"RET-{retiro.id:06d}",
            "retiro_id": retiro.id,
            "marca_id": retiro.marca_id,
            "marca": brand_name,
            "fecha": retiro.fecha_retiro.isoformat() if retiro.fecha_retiro else None,
            "motivo": retiro.motivo,
            "solicitado_por": user_name,
            "estado": status_name,
            "items": len(productos),
            "unidades": sum(item["cantidad"] for item in productos),
            "productos": productos,
        }

    @staticmethod
    def create(db: Session, retiro_in: RetiroCreate, usuario_id: int) -> dict:
        product_ids = [item.producto_id for item in retiro_in.productos]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Cada producto debe aparecer una sola vez en el retiro")

        marca = db.query(Marca).filter(Marca.id == retiro_in.marca_id).first()
        if not marca:
            raise ValueError("La marca seleccionada no existe")

        try:
            productos = (
                db.query(Producto)
                .filter(Producto.id.in_(product_ids))
                .with_for_update()
                .all()
            )
            products_by_id = {product.id: product for product in productos}
            for product_id in product_ids:
                product = products_by_id.get(product_id)
                if not product:
                    raise ValueError(f"El producto {product_id} no existe")
                if product.marca_id != retiro_in.marca_id:
                    raise ValueError(f"El producto {product.nombre} no pertenece a {marca.nombre_marca}")

            stocks = InventarioService._get_stock_by_product(db, product_ids)
            for item in retiro_in.productos:
                product = products_by_id[item.producto_id]
                available = stocks.get(item.producto_id, 0)
                if item.cantidad > available:
                    raise ValueError(
                        f"Stock insuficiente para {product.nombre}: disponible {available}, solicitado {item.cantidad}"
                    )

            status_row = (
                db.query(Estado)
                .filter(Estado.modulo == "retiros", Estado.nombre == "Completado")
                .first()
            )
            if not status_row:
                status_row = Estado(
                    modulo="retiros",
                    nombre="Completado",
                    descripcion="Retiro de mercancía registrado y descontado del inventario",
                )
                db.add(status_row)
                db.flush()

            # These legacy tables do not have identity defaults. The table locks
            # make MAX(id) + 1 safe against concurrent retires from this service.
            db.execute(text("LOCK TABLE public.retiros, public.detalle_retiro IN EXCLUSIVE MODE"))
            retiro_id = int(db.query(func.coalesce(func.max(Retiro.id), 0)).scalar() or 0) + 1
            detalle_id = int(db.query(func.coalesce(func.max(DetalleRetiro.detalle_id), 0)).scalar() or 0) + 1

            retiro = Retiro(
                id=retiro_id,
                marca_id=marca.id,
                usuario_id=usuario_id,
                motivo=retiro_in.motivo.strip(),
                estado_id=status_row.id,
            )
            db.add(retiro)
            db.flush()

            detalles = []
            movimientos = []
            for offset, item in enumerate(retiro_in.productos):
                product = products_by_id[item.producto_id]
                detalles.append(DetalleRetiro(
                    detalle_id=detalle_id + offset,
                    retiro_id=retiro.id,
                    producto_id=product.id,
                    cantidad=item.cantidad,
                ))
                movimientos.append(Kardex(
                    producto_id=product.id,
                    usuario_id=usuario_id,
                    tipo_movimiento="RETIRO",
                    cantidad=item.cantidad,
                    referencia_id=retiro.id,
                    motivo=f"Retiro de mercadería de {marca.nombre_marca}: {retiro_in.motivo.strip()}",
                ))

            db.add_all(detalles + movimientos)
            db.commit()
            return BajasRetirosService.get_detail(db, retiro.id)
        except Exception:
            db.rollback()
            raise
