from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.renta import RentaConfigUpsert, RentaPagoCreate
from app.services.renta_service import RentaService, current_period


router = APIRouter()


@router.get("/")
def list_rentas(
    periodo: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    return RentaService.list_for_period(db, periodo or current_period())


@router.post("/configuraciones", status_code=201)
def save_renta_config(payload: RentaConfigUpsert, db: Session = Depends(get_db)):
    return RentaService.save_config(db, payload.model_dump())


@router.post("/generar")
def generate_rentas(
    periodo: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    return RentaService.generate(db, periodo)


@router.post("/{renta_id}/pagos", status_code=201)
def create_pago(renta_id: int, payload: RentaPagoCreate, db: Session = Depends(get_db)):
    return RentaService.add_payment(db, renta_id, payload.model_dump())
