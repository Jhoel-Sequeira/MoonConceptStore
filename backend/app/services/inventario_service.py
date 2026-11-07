from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import io
import os
import re
import qrcode
from PIL import Image, ImageDraw, ImageFont
from app.models.inventario import Producto, Kardex, Articulo
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
        
        common = p.articulo
        return ProductoResponse(
            id=p.id,
            sku=p.sku,
            nombre=common.nombre if common else p.nombre,
            descripcion=common.descripcion if common else p.descripcion,
            tamano=p.tamano,
            precio=float((common.precio if common else p.precio) or 0),
            stock_critico=5 if (common.stock_critico if common else p.stock_critico) is None else int(common.stock_critico if common else p.stock_critico),
            imagen_url=common.imagen_url if common else p.imagen_url,
            imagenes=(common.imagenes or ([common.imagen_url] if common.imagen_url else [])) if common else (p.imagenes or ([p.imagen_url] if p.imagen_url else [])),
            estado_id=p.estado_id or 1,
            codigo_qr=p.codigo_qr or f"BHPOS-{p.sku}",
            qr_image_url=qr_rel_path,
            marca_id=p.marca_id,
            marca_nombre=marca_nom,
            categoria=(common.categoria if common else p.categoria) or (p.marca.categoria if p.marca else "ROPA VARIADA"),
            detalles_rubro=(common.detalles_rubro if common else p.detalles_rubro) or {},
            marca_codigo=marca_cod,
            stock_actual=int(stock),
            qr_status="Generado" if p.codigo_qr else "Pendiente Imprimir",
            articulo_id=p.articulo_id,
            codigo_articulo=common.codigo if common else None,
            talla=p.tamano,
            color=p.color,
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
            query = query.filter(
                (Producto.nombre.ilike(s))
                | (Producto.sku.ilike(s))
                | (Producto.codigo_qr.ilike(s))
                | (Producto.descripcion.ilike(s))
                | (Producto.tamano.ilike(s))
                | (Producto.color.ilike(s))
                | (Producto.articulo.has(Articulo.codigo.ilike(s)))
            )
            
        productos = query.options(joinedload(Producto.marca), joinedload(Producto.articulo)).order_by(Producto.id.desc()).all()
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
            color=item_in.color,
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
    def create_article(db: Session, item_in, usuario_id: int = 1) -> List[ProductoResponse]:
        code = item_in.codigo.strip().upper()
        if not code:
            raise ValueError("El código del artículo es obligatorio")
        if not item_in.nombre.strip():
            raise ValueError("El nombre del artículo es obligatorio")
        if db.query(Articulo.id).filter(func.upper(Articulo.codigo) == code).first():
            raise ValueError(f"El código de artículo {code} ya está registrado")
        skus = [variant.sku.strip().upper() for variant in item_in.variantes]
        if len(set(skus)) != len(skus):
            raise ValueError("Cada variante debe tener un SKU diferente")
        if any(not sku for sku in skus):
            raise ValueError("Todas las variantes deben tener un SKU")
        combinations = [((variant.talla or "").strip().casefold(), (variant.color or "").strip().casefold()) for variant in item_in.variantes]
        if len(set(combinations)) != len(combinations):
            raise ValueError("No repitas la misma combinación de talla y color")
        existing = db.query(Producto.sku).filter(func.upper(Producto.sku).in_(skus)).first()
        if existing:
            raise ValueError(f"El SKU {existing[0]} ya está registrado")
        marca = db.query(Marca).filter(Marca.id == item_in.marca_id).first()
        if not marca:
            raise ValueError("La marca seleccionada no existe")
        category = marca.categoria or "ROPA VARIADA"
        article = Articulo(
            codigo=code, marca_id=marca.id, categoria=category,
            detalles_rubro=validate_category_details(category, item_in.detalles_rubro),
            nombre=item_in.nombre.strip(), descripcion=item_in.descripcion, precio=item_in.precio,
            stock_critico=item_in.stock_critico, imagen_url=item_in.imagen_url,
            imagenes=item_in.imagenes, estado_id=item_in.estado_id,
        )
        db.add(article)
        db.flush()
        variants = []
        for variant, sku in zip(item_in.variantes, skus):
            product = Producto(
                articulo_id=article.id, color=(variant.color or "").strip() or None,
                marca_id=marca.id, categoria=category, detalles_rubro=article.detalles_rubro,
                sku=sku, codigo_qr=f"BHPOS-{sku}", nombre=article.nombre,
                descripcion=article.descripcion, precio=article.precio,
                tamano=(variant.talla or "").strip() or None, stock_inicial=0,
                stock_critico=article.stock_critico, imagen_url=article.imagen_url,
                imagenes=article.imagenes, estado_id=article.estado_id,
            )
            db.add(product)
            db.flush()
            if variant.stock_inicial:
                db.add(Kardex(producto_id=product.id, usuario_id=usuario_id,
                    tipo_movimiento="INGRESO", cantidad=variant.stock_inicial,
                    motivo=f"Stock inicial de variante del artículo {code}"))
            variants.append(product)
        db.commit()
        return [InventarioService.map_to_response(db, product) for product in variants]

    @staticmethod
    def add_article_variants(db: Session, article_id: int, variants_in, usuario_id: int = 1) -> List[ProductoResponse]:
        article = db.query(Articulo).filter(Articulo.id == article_id).with_for_update().first()
        if not article:
            raise ValueError("El artículo no existe")
        skus = [variant.sku.strip().upper() for variant in variants_in]
        if any(not sku for sku in skus) or len(set(skus)) != len(skus):
            raise ValueError("Cada variante debe tener un SKU diferente")
        existing = db.query(Producto.sku).filter(func.upper(Producto.sku).in_(skus)).first()
        if existing:
            raise ValueError(f"El SKU {existing[0]} ya está registrado")
        combinations = {( (variant.tamano or "").strip().casefold(), (variant.color or "").strip().casefold() ) for variant in article.variantes}
        new_combinations = [((variant.talla or "").strip().casefold(), (variant.color or "").strip().casefold()) for variant in variants_in]
        if len(set(new_combinations)) != len(new_combinations) or combinations.intersection(new_combinations):
            raise ValueError("El artículo ya tiene esa combinación de talla y color")
        products = []
        for variant, sku in zip(variants_in, skus):
            product = Producto(
                articulo_id=article.id, color=(variant.color or "").strip() or None,
                marca_id=article.marca_id, categoria=article.categoria,
                detalles_rubro=article.detalles_rubro, sku=sku, codigo_qr=f"BHPOS-{sku}",
                nombre=article.nombre, descripcion=article.descripcion, precio=article.precio,
                tamano=(variant.talla or "").strip() or None, stock_inicial=0,
                stock_critico=article.stock_critico, imagen_url=article.imagen_url,
                imagenes=article.imagenes, estado_id=article.estado_id,
            )
            db.add(product)
            db.flush()
            if variant.stock_inicial:
                db.add(Kardex(producto_id=product.id, usuario_id=usuario_id,
                    tipo_movimiento="INGRESO", cantidad=variant.stock_inicial,
                    motivo=f"Stock inicial de variante del artículo {article.codigo}"))
            products.append(product)
        db.commit()
        return [InventarioService.map_to_response(db, product) for product in products]

    @staticmethod
    def update(db: Session, producto_id: int, item_in: ProductoUpdate, usuario_id: int = 1) -> Optional[ProductoResponse]:
        p = db.query(Producto).filter(Producto.id == producto_id).with_for_update().first()
        if not p:
            return None
        
        update_data = item_in.dict(exclude_unset=True)
        article = p.articulo
        shared_fields = {"nombre", "descripcion", "precio", "stock_critico", "imagen_url", "imagenes", "estado_id", "marca_id", "categoria", "detalles_rubro"}
        shared_updates = {key: update_data.pop(key) for key in list(update_data) if article and key in shared_fields}
        for field in ("marca_id", "precio", "stock_critico", "estado_id"):
            if field in shared_updates and shared_updates[field] is None:
                raise ValueError(f"El campo {field} no puede quedar vacío")
        if article and "marca_id" in shared_updates and not db.query(Marca.id).filter(Marca.id == shared_updates["marca_id"]).first():
            raise ValueError("La marca seleccionada no existe")
        if article and "nombre" in shared_updates:
            shared_updates["nombre"] = (shared_updates["nombre"] or "").strip()
            if not shared_updates["nombre"]:
                raise ValueError("El nombre del artículo es obligatorio")
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
            if shared_updates:
                for key, value in shared_updates.items():
                    setattr(article, key, value)
                if "marca_id" in shared_updates or "categoria" in shared_updates:
                    brand_id = shared_updates.get("marca_id", article.marca_id)
                    category = db.query(Marca).filter(Marca.id == brand_id).first().categoria
                    article.categoria = category
                    for variant in article.variantes:
                        variant.marca_id = brand_id
                        variant.categoria = category
                        if "detalles_rubro" not in shared_updates:
                            variant.detalles_rubro = {}
                if "detalles_rubro" in shared_updates:
                    article.detalles_rubro = validate_category_details(article.categoria, shared_updates["detalles_rubro"])
                for variant in article.variantes:
                    for key, value in shared_updates.items():
                        if key not in {"marca_id", "categoria", "detalles_rubro"}:
                            setattr(variant, key, value)
                    variant.detalles_rubro = article.detalles_rubro
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
        article = p.articulo
        db.delete(p)
        if article and len(article.variantes) <= 1:
            db.delete(article)
        db.commit()
        return True

    @staticmethod
    def generate_qr_image(data_text: str, sku: str, price=None) -> io.BytesIO:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(data_text.encode("utf-8"), optimize=0)
        qr.make(fit=True)
        qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        regular_paths = (
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-ExtraLight.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "C:/Windows/Fonts/calibril.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "C:/Windows/Fonts/arial.ttf",
        )
        bold_paths = (
            "C:/Windows/Fonts/arialbd.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        )

        def load_label_font(paths, size):
            for path in paths:
                if os.path.exists(path):
                    try:
                        return ImageFont.truetype(path, size), False
                    except OSError:
                        continue
            # ponytail: Pillow 10.1+ supplies a scalable built-in font when OS fonts are unavailable.
            return ImageFont.load_default(size=size), True

        detail_font, detail_fallback = load_label_font(regular_paths, 30)
        price_font, price_fallback = load_label_font(bold_paths, 44)

        width, height = 900, 720
        card = Image.new("RGB", (width, height), "white")
        draw = ImageDraw.Draw(card)
        draw.rounded_rectangle((48, 30, width - 48, height - 30), radius=28, fill="white", outline="#d2d2d2", width=4)
        qr_image = qr_image.resize((450, 450), Image.Resampling.NEAREST)
        center_x = width // 2
        card.paste(qr_image, ((width - qr_image.width) // 2, 38))

        sku_label = f"Codigo: {sku}"
        detail_size = 30
        while detail_size > 24 and draw.textbbox((0, 0), sku_label, font=detail_font)[2] > 760:
            detail_size -= 2
            detail_font, detail_fallback = load_label_font(regular_paths, detail_size)
        draw.text((center_x, 510), sku_label, fill="#555555", font=detail_font, anchor="mt")
        draw.text((center_x, 570), f"C$ {price:,.2f}" if price is not None else "", fill="#111111", font=price_font, anchor="mt", stroke_width=1 if price_fallback else 0, stroke_fill="#111111")
        img = card
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf
