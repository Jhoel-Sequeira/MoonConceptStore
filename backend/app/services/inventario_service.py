from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import io
import re
import qrcode
from app.models.inventario import Producto, Kardex
from app.models.marcas import Marca
from app.schemas.inventario import ProductoCreate, ProductoUpdate, ProductoResponse, InventarioStats
from app.core.categories import validate_category_details

class InventarioService:
    @staticmethod
    def get_stock(db: Session, producto_id: int) -> int:
        stock_inicial = db.query(Producto.stock_inicial).filter(Producto.id == producto_id).scalar() or 0
        movimientos = db.query(
            Kardex.tipo_movimiento,
            func.coalesce(func.sum(Kardex.cantidad), 0).label("total")
        ).filter(Kardex.producto_id == producto_id).group_by(Kardex.tipo_movimiento).all()

        stock = int(stock_inicial)
        for mov in movimientos:
            tipo = str(mov.tipo_movimiento).upper()
            cant = int(mov.total or 0)
            if tipo in ["INGRESO", "ENTRADA", "AJUSTE_POSITIVO"]:
                stock += cant
            elif tipo in ["VENTA", "BAJA", "SALIDA", "RETIRO", "AJUSTE_NEGATIVO"]:
                stock -= cant
        return max(0, int(stock))

    @staticmethod
    @staticmethod
    def _get_stock_by_product(db: Session, producto_ids: Optional[List[int]] = None) -> dict:
        """Calcula el stock de varios productos con una sola consulta al Kardex."""
        query = db.query(Producto.id, Producto.stock_inicial)
        if producto_ids is not None:
            if not producto_ids:
                return {}
            query = query.filter(Producto.id.in_(producto_ids))
        stocks = {int(product_id): int(initial_stock or 0) for product_id, initial_stock in query.all()}
        movements = db.query(
            Kardex.producto_id,
            Kardex.tipo_movimiento,
            func.coalesce(func.sum(Kardex.cantidad), 0).label("total"),
        )
        if producto_ids is not None:
            movements = movements.filter(Kardex.producto_id.in_(producto_ids))
        for product_id, movement_type, total in movements.group_by(
            Kardex.producto_id, Kardex.tipo_movimiento
        ).all():
            kind = str(movement_type).upper()
            quantity = int(total or 0)
            if kind in ["INGRESO", "ENTRADA", "AJUSTE_POSITIVO"]:
                stocks[int(product_id)] = stocks.get(int(product_id), 0) + quantity
            elif kind in ["VENTA", "BAJA", "SALIDA", "RETIRO", "AJUSTE_NEGATIVO"]:
                stocks[int(product_id)] = stocks.get(int(product_id), 0) - quantity
        return {product_id: max(0, stock) for product_id, stock in stocks.items()}

    @staticmethod
    def map_to_response(db: Session, p: Producto, stock: Optional[int] = None) -> ProductoResponse:
        if stock is None:
            stock = InventarioService.get_stock(db, p.id)
        marca_nom = p.marca.nombre_marca if p.marca else None
        marca_cod = p.marca.codigo if p.marca else None
        
        qr_rel_path = f"/api/v1/inventario/{p.id}/qr-image"
        
        return ProductoResponse(
            id=p.id,
            sku=p.sku,
            nombre=p.nombre,
            descripcion=p.descripcion,
            tamano=p.tamano,
            precio=float(p.precio or 0),
            stock_critico=5 if p.stock_critico is None else int(p.stock_critico),
            imagen_url=p.imagen_url,
            imagenes=p.imagenes or ([p.imagen_url] if p.imagen_url else []),
            estado_id=p.estado_id or 1,
            codigo_qr=p.codigo_qr or f"BHPOS-{p.sku}",
            qr_image_url=qr_rel_path,
            marca_id=p.marca_id,
            marca_nombre=marca_nom,
            categoria=p.categoria or (p.marca.categoria if p.marca else "ROPA VARIADA"),
            detalles_rubro=p.detalles_rubro or {},
            marca_codigo=marca_cod,
            stock_actual=int(stock),
            qr_status="Generado" if p.codigo_qr else "Pendiente Imprimir"
        )

    @staticmethod
    def get_all(
        db: Session, 
        marca_id: Optional[int] = None, 
        search: Optional[str] = None,
        categoria: Optional[str] = None,
    ) -> List[ProductoResponse]:
        query = db.query(Producto)
        if marca_id:
            query = query.filter(Producto.marca_id == marca_id)
        if categoria:
            query = query.filter(Producto.categoria == categoria)
        if search:
            s = f"%{search.strip()}%"
            query = query.filter((Producto.nombre.ilike(s)) | (Producto.sku.ilike(s)) | (Producto.descripcion.ilike(s)))
            
        productos = query.options(joinedload(Producto.marca)).order_by(Producto.id.desc()).all()
        stocks = InventarioService._get_stock_by_product(db, [p.id for p in productos])
        return [InventarioService.map_to_response(db, p, stocks.get(p.id, 0)) for p in productos]

    @staticmethod
    def get_by_id(db: Session, producto_id: int) -> Optional[ProductoResponse]:
        p = db.query(Producto).filter(Producto.id == producto_id).first()
        if not p:
            return None
        return InventarioService.map_to_response(db, p)

    @staticmethod
    def get_stats(db: Session) -> InventarioStats:
        productos = db.query(Producto).all()
        stocks = InventarioService._get_stock_by_product(db, [p.id for p in productos])
        total_skus = len(productos)
        total_unidades = 0
        skus_bajo = 0
        total_valor = 0.0

        for p in productos:
            stk = int(stocks.get(p.id, 0))
            total_unidades += stk
            if stk <= (5 if p.stock_critico is None else int(p.stock_critico)):
                skus_bajo += 1
            total_valor += float(p.precio or 0) * float(stk)

        return InventarioStats(
            total_skus=int(total_skus),
            total_stock_unidades=int(total_unidades),
            skus_bajo_stock=int(skus_bajo),
            total_valor_inventario=round(float(total_valor), 2)
        )

    @staticmethod
    def create(db: Session, item_in: ProductoCreate, usuario_id: int = 1) -> ProductoResponse:
        sku = item_in.sku.strip().upper()
        if not sku:
            raise ValueError("El SKU es obligatorio")
        marca = db.query(Marca).filter(Marca.id == item_in.marca_id).first()
        if not marca:
            raise ValueError("La marca seleccionada no existe")
        if db.query(Producto.id).filter(func.upper(Producto.sku) == sku).first():
            raise ValueError(f"El SKU {sku} ya está registrado")
        qr_code_str = f"BHPOS-{sku}"
        nuevo = Producto(
            marca_id=item_in.marca_id,
            categoria=marca.categoria or "ROPA VARIADA",
            detalles_rubro=validate_category_details(marca.categoria or "ROPA VARIADA", item_in.detalles_rubro),
            sku=sku,
            nombre=item_in.nombre.strip(),
            descripcion=item_in.descripcion,
            tamano=item_in.tamano,
            precio=item_in.precio,
            stock_critico=5 if item_in.stock_critico is None else item_in.stock_critico,
            imagen_url=item_in.imagen_url,
            estado_id=item_in.estado_id or 1,
            codigo_qr=qr_code_str
        )
        try:
            db.add(nuevo)
            db.flush()
            if item_in.stock_inicial and item_in.stock_inicial > 0:
                db.add(Kardex(
                    producto_id=nuevo.id,
                    usuario_id=usuario_id,
                    tipo_movimiento="INGRESO",
                    cantidad=item_in.stock_inicial,
                    motivo="Stock inicial de inventario",
                ))
            db.commit()
            db.refresh(nuevo)
        except IntegrityError as exc:
            db.rollback()
            raise ValueError(f"No se pudo guardar el producto. Verifica que el SKU {sku} no esté repetido.") from exc

        return InventarioService.map_to_response(db, nuevo)

    @staticmethod
    def update(db: Session, producto_id: int, item_in: ProductoUpdate, usuario_id: int = 1) -> Optional[ProductoResponse]:
        p = db.query(Producto).filter(Producto.id == producto_id).with_for_update().first()
        if not p:
            return None
        
        update_data = item_in.dict(exclude_unset=True)
        stock_was_sent = "stock_actual" in update_data
        target_stock = update_data.pop("stock_actual", None)
        if "sku" in update_data:
            if update_data["sku"] is None:
                raise ValueError("El SKU no puede quedar vacio")
            update_data["sku"] = (update_data["sku"] or "").strip().upper()
            if not update_data["sku"]:
                raise ValueError("El SKU no puede quedar vacio")
            if db.query(Producto.id).filter(
                func.upper(Producto.sku) == update_data["sku"], Producto.id != producto_id
            ).first():
                raise ValueError(f"El SKU {update_data['sku']} ya está registrado")
        if "marca_id" in update_data:
            marca = db.query(Marca).filter(Marca.id == update_data["marca_id"]).first()
            if not marca:
                raise ValueError("La marca seleccionada no existe")
            update_data["categoria"] = marca.categoria or "ROPA VARIADA"
            if "detalles_rubro" in update_data:
                update_data["detalles_rubro"] = validate_category_details(update_data["categoria"], update_data["detalles_rubro"])
            elif marca.id != p.marca_id:
                update_data["detalles_rubro"] = {}
        elif "detalles_rubro" in update_data:
            update_data["detalles_rubro"] = validate_category_details(p.categoria, update_data["detalles_rubro"])
        if "nombre" in update_data:
            update_data["nombre"] = (update_data["nombre"] or "").strip()
            if not update_data["nombre"]:
                raise ValueError("El nombre del producto es obligatorio")
        for field in ("marca_id", "precio", "stock_critico", "estado_id"):
            if field in update_data and update_data[field] is None:
                raise ValueError(f"El campo {field} no puede quedar vacio")
        if stock_was_sent and target_stock is None:
            raise ValueError("El stock actual no puede quedar vacio")
        try:
            if "sku" in update_data:
                p.codigo_qr = f"BHPOS-{update_data['sku']}"
            for key, val in update_data.items():
                setattr(p, key, val)
            if target_stock is not None:
                current_stock = InventarioService.get_stock(db, p.id)
                difference = int(target_stock) - current_stock
                if difference:
                    db.add(Kardex(
                        producto_id=p.id,
                        usuario_id=usuario_id,
                        tipo_movimiento="AJUSTE_POSITIVO" if difference > 0 else "AJUSTE_NEGATIVO",
                        cantidad=abs(difference),
                        motivo=f"Ajuste de inventario desde el formulario ({current_stock} a {target_stock})",
                    ))
            db.commit()
            db.refresh(p)
        except IntegrityError as exc:
            db.rollback()
            raise ValueError("No se pudo actualizar el producto. Verifica el SKU y la marca.") from exc
        return InventarioService.map_to_response(db, p)

    @staticmethod
    def delete(db: Session, producto_id: int) -> bool:
        p = db.query(Producto).filter(Producto.id == producto_id).first()
        if not p:
            return False
        referenced = db.execute(
            text("""
                SELECT EXISTS (
                    SELECT 1 FROM compra_detalles WHERE producto_id = :id
                    UNION ALL SELECT 1 FROM detalle_retiro WHERE producto_id = :id
                    UNION ALL SELECT 1 FROM importacion_jmscents WHERE producto_id = :id
                    UNION ALL SELECT 1 FROM ingreso_detalles WHERE producto_id = :id
                    UNION ALL SELECT 1 FROM liquidacion_detalles WHERE producto_id = :id
                    UNION ALL SELECT 1 FROM pedidos_excel WHERE producto_id = :id
                    UNION ALL SELECT 1 FROM venta_detalles WHERE producto_id = :id
                    UNION ALL SELECT 1 FROM ventas_excel WHERE producto_id = :id
                )
            """),
            {"id": producto_id},
        ).scalar()
        if referenced:
            raise ValueError("No se puede eliminar: el producto tiene movimientos o documentos asociados y debe conservar su historial.")
        # Eliminar registros de kardex asociados primero
        db.query(Kardex).filter(Kardex.producto_id == producto_id).delete()
        db.delete(p)
        db.commit()
        return True

    @staticmethod
    def generate_qr_image(data_text: str) -> io.BytesIO:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(data_text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf
