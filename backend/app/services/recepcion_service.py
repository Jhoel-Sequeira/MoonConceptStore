from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.ingresos import Ingreso, IngresoDetalle
from app.models.inventario import Producto
from app.models.marcas import Marca
from app.models.usuarios import Usuario


class RecepcionService:
    @staticmethod
    def get_all(db: Session) -> list[dict]:
        ingresos = (
            db.query(Ingreso, Marca.nombre_marca, Usuario.nombre)
            .join(Marca, Marca.id == Ingreso.marca_id)
            .join(Usuario, Usuario.id == Ingreso.usuario_id)
            .filter(Ingreso.tipo_carga == "IMPORTACION EXCEL")
            .order_by(Ingreso.fecha_ingreso.desc(), Ingreso.id.desc())
            .all()
        )
        if not ingresos:
            return []

        ingreso_ids = [row[0].id for row in ingresos]
        summary_rows = (
            db.query(
                IngresoDetalle.ingreso_id,
                func.count(IngresoDetalle.id),
                func.coalesce(func.sum(IngresoDetalle.cantidad), 0),
            )
            .filter(IngresoDetalle.ingreso_id.in_(ingreso_ids))
            .group_by(IngresoDetalle.ingreso_id)
            .all()
        )
        summaries = {row[0]: (int(row[1]), int(row[2])) for row in summary_rows}

        results = []
        for ingreso, marca_nombre, usuario_nombre in ingresos:
            item_count, units = summaries.get(ingreso.id, (0, 0))
            results.append({
                "id": f"ING-{ingreso.id:06d}",
                "ingreso_id": ingreso.id,
                "marca_id": ingreso.marca_id,
                "marca": marca_nombre,
                "fecha": ingreso.fecha_ingreso.isoformat() if ingreso.fecha_ingreso else None,
                "items": item_count,
                "unidades": units,
                "recibido_por": usuario_nombre,
                "estado": "Importada",
                "comprobante": ingreso.observaciones or ingreso.tipo_carga,
            })
        return results

    @staticmethod
    def get_detail(db: Session, ingreso_id: int) -> dict | None:
        row = (
            db.query(Ingreso, Marca.nombre_marca, Usuario.nombre)
            .join(Marca, Marca.id == Ingreso.marca_id)
            .join(Usuario, Usuario.id == Ingreso.usuario_id)
            .filter(
                Ingreso.id == ingreso_id,
                Ingreso.tipo_carga == "IMPORTACION EXCEL",
            )
            .first()
        )
        if not row:
            return None

        ingreso, marca_nombre, usuario_nombre = row
        details = (
            db.query(IngresoDetalle, Producto)
            .join(Producto, Producto.id == IngresoDetalle.producto_id)
            .filter(IngresoDetalle.ingreso_id == ingreso.id)
            .order_by(IngresoDetalle.id)
            .all()
        )
        productos = [{
            "id": product.id,
            "sku": product.sku,
            "nombre": product.nombre,
            "descripcion": product.descripcion,
            "tamano": product.tamano,
            "precio": float(product.precio or 0),
            "costo": float(detail.precio_ingreso) if detail.precio_ingreso is not None else None,
            "cantidad": int(detail.cantidad),
            "stock_critico": int(product.stock_critico or 0),
            "imagen_url": product.imagen_url,
            "codigo_qr": product.codigo_qr,
        } for detail, product in details]

        return {
            "id": f"ING-{ingreso.id:06d}",
            "ingreso_id": ingreso.id,
            "marca_id": ingreso.marca_id,
            "marca": marca_nombre,
            "fecha": ingreso.fecha_ingreso.isoformat() if ingreso.fecha_ingreso else None,
            "recibido_por": usuario_nombre,
            "estado": "Importada",
            "comprobante": ingreso.observaciones or ingreso.tipo_carga,
            "items": len(productos),
            "unidades": sum(item["cantidad"] for item in productos),
            "productos": productos,
        }
