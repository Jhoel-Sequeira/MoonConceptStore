from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import os
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.usuarios import Usuario
from app.schemas.marcas import MarcaCreate, MarcaUpdate, MarcaResponse
from app.services.marcas_service import MarcasService
from app.core.storage import delete_image, upload_image

router = APIRouter()

@router.get("/", response_model=List[MarcaResponse])
def get_marcas(db: Session = Depends(get_db)):
    """Obtener listado de todas las marcas con sus métricas y cuentas bancarias"""
    return MarcasService.get_all(db)

@router.get("/{marca_id}", response_model=MarcaResponse)
def get_marca(marca_id: int, db: Session = Depends(get_db)):
    """Obtener detalle de una marca por ID"""
    marca = MarcasService.get_by_id(db, marca_id)
    if not marca:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Marca con ID {marca_id} no encontrada"
        )
    return marca

@router.post("/", response_model=MarcaResponse, status_code=status.HTTP_201_CREATED)
def create_marca(marca_in: MarcaCreate, db: Session = Depends(get_db)):
    """Crear y registrar una nueva marca aliada"""
    try:
        return MarcasService.create(db, marca_in)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al registrar la marca: {str(e)}"
        )

@router.put("/{marca_id}", response_model=MarcaResponse)
def update_marca(marca_id: int, marca_in: MarcaUpdate, db: Session = Depends(get_db)):
    """Actualizar datos de una marca aliada"""
    try:
        updated = MarcasService.update(db, marca_id, marca_in)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Marca con ID {marca_id} no encontrada"
            )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al actualizar la marca: {str(e)}"
        )

@router.delete("/{marca_id}", status_code=status.HTTP_200_OK)
def delete_marca(marca_id: int, db: Session = Depends(get_db)):
    """Eliminar o dar de baja una marca aliada"""
    try:
        success = MarcasService.delete(db, marca_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Marca con ID {marca_id} no encontrada"
            )
        return {"status": "ok", "message": f"Marca con ID {marca_id} eliminada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al eliminar la marca: {str(e)}"
        )

@router.post("/{marca_id}/logo", response_model=MarcaResponse)
def upload_logo(
    marca_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Subir imagen de logo de una marca y guardar la ruta en base de datos"""
    marca = MarcasService.get_by_id(db, marca_id)
    if not marca:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Marca no encontrada")
    previous_logo_url = marca.get("logo")

    # Extensiones permitidas
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp", ".svg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagen no soportado. Usa PNG, JPG, WEBP o SVG."
        )

    content = file.file.read(8 * 1024 * 1024 + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selecciona una imagen")
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El logo no puede superar 8 MB")
    content_type = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".svg": "image/svg+xml",
    }[ext]
    logo_url = upload_image(f"moonconcept/logos/{marca_id}", f"logo{ext}", content, content_type)
    updated = MarcasService.update_logo(db, marca_id, logo_url)
    if updated:
        delete_image(previous_logo_url or "")
    return updated

@router.get("/{marca_id}/ficha-entrega")
def download_ficha_entrega(marca_id: int, db: Session = Depends(get_db)):
    """Descargar Ficha de Entrega de Mercadería en Excel (XLSX) con los datos y productos de la marca"""
    output, filename = MarcasService.generate_delivery_sheet(db, marca_id)
    if not output:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Marca no encontrada")

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/{marca_id}/importar-productos")
def import_marca_products(
    marca_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Selecciona una plantilla Excel .xlsx")
    try:
        result = MarcasService.import_delivery_template(
            db, marca_id, file.file.read(), current_user.id, file.filename
        )
        return {"message": "Mercadería importada al inventario", **result}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"No se pudo importar la plantilla: {exc}") from exc

