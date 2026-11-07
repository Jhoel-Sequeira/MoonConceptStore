from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, UploadFile, File, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape
from PIL import Image
from app.core.storage import delete_image, upload_image
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.usuarios import Usuario
from app.schemas.inventario import (
    ProductoCreate,
    ArticuloCreate,
    VarianteCreate,
    ProductoUpdate,
    ProductoResponse,
    InventarioStats
)
from app.services.inventario_service import InventarioService
from app.models.inventario import Producto
from app.core.categories import PRODUCT_CATEGORIES

router = APIRouter()


@router.post("/articulos", status_code=status.HTTP_201_CREATED)
def create_articulo(
    item_in: ArticuloCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Create one shared article and its independently stocked variants."""
    try:
        return InventarioService.create_article(db, item_in, current_user.id)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/articulos/{articulo_id}/variantes", status_code=status.HTTP_201_CREATED)
def add_articulo_variantes(
    articulo_id: int,
    variantes: List[VarianteCreate] = Body(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    try:
        if not variantes:
            raise ValueError("Agrega al menos una variante")
        return InventarioService.add_article_variants(db, articulo_id, variantes, current_user.id)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/qr-word")
def export_qr_word(product_ids: List[int] = Body(...), db: Session = Depends(get_db)):
    """Create an editable Word document with one high-resolution QR label image per product."""
    if not product_ids:
        raise HTTPException(status_code=422, detail="Selecciona al menos un producto")
    products = db.query(Producto).filter(Producto.id.in_(set(product_ids))).all()
    by_id = {product.id: product for product in products}
    if len(by_id) != len(set(product_ids)):
        raise HTTPException(status_code=404, detail="Uno o más productos ya no existen")

    document_rows = []
    relationships = []
    images = []
    for index, product_id in enumerate(dict.fromkeys(product_ids), start=1):
        product = by_id[product_id]
        image = InventarioService.generate_qr_image(
            product.codigo_qr or f"BHPOS-{product.sku}", product.sku, product.precio
        ).getvalue()
        rel_id = f"rId{index}"
        images.append((f"word/media/qr{index}.png", image))
        relationships.append(
            f'<Relationship Id="{rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qr{index}.png"/>'
        )
        cell = (
            f'<w:tc><w:tcPr><w:tcW w:w="2700" w:type="dxa"/></w:tcPr>'
            f'<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="1508760" cy="1207008"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
            f'<wp:docPr id="{index}" name="QR {escape(product.sku or str(product.id))}"/>'
            f'<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
            f'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f'<pic:pic><pic:nvPicPr><pic:cNvPr id="{index}" name="QR {escape(product.sku or str(product.id))}.png"/><pic:cNvPicPr/></pic:nvPicPr>'
            f'<pic:blipFill><a:blip r:embed="{rel_id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1508760" cy="1207008"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
            f'</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:tc>'
        )
        if index % 4 == 1:
            document_rows.append([cell])
        else:
            document_rows[-1].append(cell)

    while len(document_rows[-1]) < 4:
        document_rows[-1].append('<w:tc><w:tcPr><w:tcW w:w="2700" w:type="dxa"/></w:tcPr><w:p/></w:tc>')
    table = (
        '<w:tbl><w:tblPr><w:tblW w:w="10800" w:type="dxa"/><w:tblLayout w:type="fixed"/>'
        '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>'
        '<w:tblGrid><w:gridCol w:w="2700"/><w:gridCol w:w="2700"/><w:gridCol w:w="2700"/><w:gridCol w:w="2700"/></w:tblGrid>'
        + ''.join('<w:tr>' + ''.join(row) + '</w:tr>' for row in document_rows)
        + '</w:tbl>'
    )

    xml_document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'
        + table
        + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>'
    )
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        archive.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        archive.writestr("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(relationships) + '</Relationships>')
        archive.writestr("word/document.xml", xml_document)
        for path, image in images:
            archive.writestr(path, image)
    output.seek(0)
    return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", headers={"Content-Disposition": "attachment; filename=Codigos_QR.docx"})

@router.get("/", response_model=List[ProductoResponse])
def get_productos(
    marca_id: Optional[int] = Query(None, description="Filtrar por ID de marca"),
    search: Optional[str] = Query(None, description="Búsqueda por SKU o nombre"),
    categoria: Optional[str] = Query(None, description="Filtrar por rubro"),
    db: Session = Depends(get_db)
):
    """Listar productos de inventario con stock calculado y QR status"""
    if categoria and categoria not in PRODUCT_CATEGORIES:
        raise HTTPException(status_code=422, detail="Rubro no válido")
    return InventarioService.get_all(db, marca_id=marca_id, search=search, categoria=categoria)

@router.get("/stats", response_model=InventarioStats)
def get_inventario_stats(db: Session = Depends(get_db)):
    """Obtener métricas globales de inventario"""
    return InventarioService.get_stats(db)

@router.get("/{producto_id}", response_model=ProductoResponse)
def get_producto(producto_id: int, db: Session = Depends(get_db)):
    """Obtener un producto específico por ID"""
    producto = InventarioService.get_by_id(db, producto_id)
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con ID {producto_id} no encontrado"
        )
    return producto

@router.post("/", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
def create_producto(
    item_in: ProductoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Registrar un nuevo producto en inventario"""
    try:
        return InventarioService.create(db, item_in, current_user.id)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al registrar producto: {str(e)}"
        )

@router.put("/{producto_id}", response_model=ProductoResponse)
def update_producto(
    producto_id: int,
    item_in: ProductoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Actualizar datos de un producto"""
    try:
        updated = InventarioService.update(db, producto_id, item_in, current_user.id)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto con ID {producto_id} no encontrado"
            )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al actualizar producto: {str(e)}"
        )

@router.delete("/{producto_id}", status_code=status.HTTP_200_OK)
def delete_producto(producto_id: int, db: Session = Depends(get_db)):
    """Eliminar un producto de inventario"""
    try:
        producto = db.query(Producto).filter(Producto.id == producto_id).first()
        image_owner = (producto.articulo or producto) if producto else None
        image_urls = list(image_owner.imagenes or []) if image_owner else []
        if image_owner and image_owner.imagen_url and image_owner.imagen_url not in image_urls:
            image_urls.append(image_owner.imagen_url)
        remove_shared_images = bool(producto and producto.articulo and len(producto.articulo.variantes) == 1)
        success = InventarioService.delete(db, producto_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto con ID {producto_id} no encontrado"
            )
        if not producto or not producto.articulo or remove_shared_images:
            for image_url in image_urls:
                delete_image(image_url)
        return {"message": "Producto eliminado exitosamente"}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

@router.post("/{producto_id}/foto")
def upload_product_photo(
    producto_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Guarda una foto validada del producto y registra su URL."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    image_owner = producto.articulo or producto

    image_bytes = file.file.read(8 * 1024 * 1024 + 1)
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selecciona una imagen")
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="La imagen no puede superar 8 MB")

    try:
        image = Image.open(BytesIO(image_bytes))
        image.verify()
        image_format = image.format
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo no es una imagen válida") from exc

    extension_by_format = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
    extension = extension_by_format.get(image_format)
    if not extension:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Formato no permitido. Usa JPG, PNG o WEBP")

    content_type = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[extension]
    image_folder = f"moonconcept/articulos/{image_owner.id}" if producto.articulo else f"moonconcept/productos/{producto_id}"
    image_url = upload_image(image_folder, f"producto{extension}", image_bytes, content_type)
    image_owner.imagen_url = image_url
    image_owner.imagenes = list(image_owner.imagenes or [])
    if image_url not in image_owner.imagenes:
        image_owner.imagenes.append(image_url)
    try:
        db.commit()
    except Exception:
        db.rollback()
        delete_image(image_url)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo guardar la foto del producto")

    return {"imagen_url": image_owner.imagen_url}

@router.post("/{producto_id}/fotos")
def upload_product_photos(
    producto_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """Agrega varias fotos validadas a la galería de un producto."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    image_owner = producto.articulo or producto
    if not files or len(files) > 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selecciona entre 1 y 10 fotos por carga")

    current_images = list(image_owner.imagenes or [])
    if len(current_images) + len(files) > 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cada producto admite un máximo de 10 fotos")

    prepared = []
    for file in files:
        image_bytes = file.file.read(8 * 1024 * 1024 + 1)
        if not image_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selecciona archivos de imagen válidos")
        if len(image_bytes) > 8 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Cada imagen puede pesar máximo 8 MB")
        try:
            image = Image.open(BytesIO(image_bytes))
            image.verify()
            image_format = image.format
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uno de los archivos no es una imagen válida") from exc
        extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}.get(image_format)
        if not extension:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Formato no permitido. Usa JPG, PNG o WEBP")
        prepared.append((image_bytes, extension))

    new_urls = []
    try:
        for image_bytes, extension in prepared:
            content_type = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[extension]
            image_folder = f"moonconcept/articulos/{image_owner.id}" if producto.articulo else f"moonconcept/productos/{producto_id}"
            new_urls.append(upload_image(image_folder, f"producto{extension}", image_bytes, content_type))

        image_owner.imagenes = current_images + new_urls
        if not image_owner.imagen_url:
            image_owner.imagen_url = new_urls[0]
        db.commit()
        db.refresh(image_owner)
    except Exception as exc:
        db.rollback()
        for image_url in new_urls:
            delete_image(image_url)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudieron guardar las fotos del producto") from exc

    return {"imagenes": image_owner.imagenes, "imagen_url": image_owner.imagen_url}

@router.delete("/{producto_id}/fotos")
def delete_product_photo(
    producto_id: int,
    image_url: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """Quita una foto de la galería del producto."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    image_owner = producto.articulo or producto
    current_images = list(image_owner.imagenes or ([image_owner.imagen_url] if image_owner.imagen_url else []))
    if image_url not in current_images:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La foto no pertenece a este producto")

    image_owner.imagenes = [url for url in current_images if url != image_url]
    if image_owner.imagen_url == image_url:
        image_owner.imagen_url = image_owner.imagenes[0] if image_owner.imagenes else None
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo quitar la foto del producto") from exc

    delete_image(image_url)
    return {"imagenes": image_owner.imagenes, "imagen_url": image_owner.imagen_url}

@router.get("/{producto_id}/qr-image")
def get_qr_image(producto_id: int, db: Session = Depends(get_db)):
    """Generar imagen PNG del código QR de un producto"""
    producto = db.query(Producto.id, Producto.sku, Producto.nombre, Producto.codigo_qr, Producto.precio).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con ID {producto_id} no encontrado"
        )
    
    qr_data = producto.codigo_qr or f"BHPOS-{producto.sku}"
    qr_buf = InventarioService.generate_qr_image(qr_data, producto.sku, producto.precio)
    return Response(content=qr_buf.getvalue(), media_type="image/png")

@router.post("/{producto_id}/generar-qr")
def regenerate_and_save_qr(producto_id: int, db: Session = Depends(get_db)):
    """Generar el código QR y guardarlo físicamente en el servidor (uploads/qr/)"""
    producto = db.query(Producto.id, Producto.sku, Producto.nombre, Producto.codigo_qr, Producto.precio).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con ID {producto_id} no encontrado"
        )
    
    qr_image = InventarioService.generate_qr_image(producto.codigo_qr or f"BHPOS-{producto.sku}", producto.sku, producto.precio)
    qr_rel_path = upload_image(
        f"moonconcept/qr/{producto.id}", "codigo.png", qr_image.getvalue(), "image/png"
    )
    return {
        "message": "Código QR generado y almacenado en el servidor",
        "qr_image_url": qr_rel_path,
        "codigo_qr": producto.codigo_qr or f"BHPOS-{producto.sku}"
    }
