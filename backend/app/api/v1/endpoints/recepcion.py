from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.recepcion_service import RecepcionService

router = APIRouter()


@router.get("/")
def get_recepcion(db: Session = Depends(get_db)):
    return RecepcionService.get_all(db)


@router.get("/{ingreso_id}")
def get_recepcion_detail(ingreso_id: int, db: Session = Depends(get_db)):
    ingreso = RecepcionService.get_detail(db, ingreso_id)
    if not ingreso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró la importación solicitada",
        )
    return ingreso
