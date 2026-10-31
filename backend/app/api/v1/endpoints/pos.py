from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.usuarios import Usuario
from app.schemas.pos import POSCommissionConfig, VentaCreate, VentaResponse
from app.services.pos_service import POSService


router = APIRouter()


@router.get("/")
def get_pos():
    return {"status": "ok", "modulo": "Punto de Venta"}


@router.get("/configuracion-comision")
def get_commission_config(db: Session = Depends(get_db)):
    return POSService.get_commission_config(db)


@router.put("/configuracion-comision", response_model=POSCommissionConfig)
def save_commission_config(payload: POSCommissionConfig, db: Session = Depends(get_db)):
    return POSService.save_commission_config(db, payload.comision_tarjeta_porcentaje)


@router.get("/ventas/historial")
def sales_history(
    desde: date | None = None,
    hasta: date | None = None,
    marca_id: int | None = Query(default=None, gt=0),
    metodo_pago: str | None = Query(default=None, max_length=100),
    buscar: str | None = Query(default=None, max_length=100),
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return POSService.list_sales(db, desde, hasta, marca_id, metodo_pago, buscar, pagina, por_pagina)


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
