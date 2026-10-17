from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.usuarios import Usuario
from app.schemas.pos import VentaCreate, VentaResponse
from app.services.pos_service import POSService


router = APIRouter()


@router.get("/")
def get_pos():
    return {"status": "ok", "modulo": "Punto de Venta"}


@router.post("/ventas", response_model=VentaResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    sale_in: VentaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    try:
        return POSService.create_sale(db, sale_in, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No se pudo emitir la factura: {exc}") from exc
