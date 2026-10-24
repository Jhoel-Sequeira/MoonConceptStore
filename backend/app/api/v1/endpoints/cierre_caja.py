from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.usuarios import Usuario
from app.schemas.cierre_caja import CierreCajaCreate
from app.services.cierre_caja_service import CierreCajaService


router = APIRouter()


@router.get("/")
@router.get("")
def get_cierre_caja(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    return CierreCajaService.current(db)


@router.post("/")
@router.post("")
def close_caja(
    values: CierreCajaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return CierreCajaService.close(db, user.id, values.model_dump())


@router.post("/reabrir")
def reopen_caja(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return CierreCajaService.reopen(db, user.id)
