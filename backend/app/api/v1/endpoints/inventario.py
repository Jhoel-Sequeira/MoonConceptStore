from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from io import BytesIO
from PIL import Image
from app.core.storage import delete_image, upload_image
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.usuarios import Usuario
from app.schemas.inventario import (
    ProductoCreate,
    ProductoUpdate,
    ProductoResponse,
    InventarioStats
)
from app.services.inventario_service import InventarioService
from app.models.inventario import Producto
from app.core.categories import PRODUCT_CATEGORIES

router = APIRouter()

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
        image_urls = list(producto.imagenes or []) if producto else []
        if producto and producto.imagen_url and producto.imagen_url not in image_urls:
            image_urls.append(producto.imagen_url)
        success = InventarioService.delete(db, producto_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto con ID {producto_id} no encontrado"
            )
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
    image_url = upload_image(f"moonconcept/productos/{producto_id}", f"producto{extension}", image_bytes, content_type)
    producto.imagen_url = image_url
    producto.imagenes = list(producto.imagenes or [])
    if producto.imagen_url not in producto.imagenes:
        producto.imagenes.append(producto.imagen_url)
    try:
        db.commit()
    except Exception:
        db.rollback()
        delete_image(image_url)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo guardar la foto del producto")

    return {"imagen_url": producto.imagen_url}

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
    if not files or len(files) > 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selecciona entre 1 y 10 fotos por carga")

    current_images = list(producto.imagenes or [])
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
            new_urls.append(upload_image(f"moonconcept/productos/{producto_id}", f"producto{extension}", image_bytes, content_type))

        producto.imagenes = current_images + new_urls
        if not producto.imagen_url:
            producto.imagen_url = new_urls[0]
        db.commit()
        db.refresh(producto)
    except Exception as exc:
        db.rollback()
        for image_url in new_urls:
            delete_image(image_url)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudieron guardar las fotos del producto") from exc

    return {"imagenes": producto.imagenes, "imagen_url": producto.imagen_url}

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
    current_images = list(producto.imagenes or ([producto.imagen_url] if producto.imagen_url else []))
    if image_url not in current_images:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La foto no pertenece a este producto")

    producto.imagenes = [url for url in current_images if url != image_url]
    if producto.imagen_url == image_url:
        producto.imagen_url = producto.imagenes[0] if producto.imagenes else None
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo quitar la foto del producto") from exc

    delete_image(image_url)
    return {"imagenes": producto.imagenes, "imagen_url": producto.imagen_url}

@router.get("/{producto_id}/qr-image")
def get_qr_image(producto_id: int, db: Session = Depends(get_db)):
    """Generar imagen PNG del código QR de un producto"""
    producto = db.query(Producto.id, Producto.sku, Producto.codigo_qr).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con ID {producto_id} no encontrado"
        )
    
    qr_data = producto.codigo_qr or f"BHPOS-{producto.sku}"
    qr_buf = InventarioService.generate_qr_image(qr_data)
    return Response(content=qr_buf.getvalue(), media_type="image/png")

@router.post("/{producto_id}/generar-qr")
def regenerate_and_save_qr(producto_id: int, db: Session = Depends(get_db)):
    """Generar el código QR y guardarlo físicamente en el servidor (uploads/qr/)"""
    producto = db.query(Producto.id, Producto.sku, Producto.codigo_qr).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con ID {producto_id} no encontrado"
        )
    
    qr_image = InventarioService.generate_qr_image(producto.codigo_qr or f"BHPOS-{producto.sku}")
    qr_rel_path = upload_image(
        f"moonconcept/qr/{producto.id}", "codigo.png", qr_image.getvalue(), "image/png"
    )
    return {
        "message": "Código QR generado y almacenado en el servidor",
        "qr_image_url": qr_rel_path,
        "codigo_qr": producto.codigo_qr or f"BHPOS-{producto.sku}"
    }
