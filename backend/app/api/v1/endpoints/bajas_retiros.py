from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.usuarios import Usuario
from app.schemas.bajas_retiros import RetiroCreate
from app.services.bajas_retiros_service import BajasRetirosService


router = APIRouter()


@router.get("/")
def get_bajas_retiros(db: Session = Depends(get_db)):
    return BajasRetirosService.get_all(db)


@router.get("/{retiro_id}")
def get_retiro_detail(retiro_id: int, db: Session = Depends(get_db)):
    retiro = BajasRetirosService.get_detail(db, retiro_id)
    if not retiro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retiro no encontrado")
    return retiro


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_retiro(
    retiro_in: RetiroCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    try:
        return BajasRetirosService.create(db, retiro_in, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No se pudo registrar el retiro: {exc}") from exc
