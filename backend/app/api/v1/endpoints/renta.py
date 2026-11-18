from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
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


@router.post("/configuraciones/importar")
def import_renta_configs(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Selecciona una plantilla Excel .xlsx")
    content = file.file.read(4 * 1024 * 1024 + 1)
    if len(content) > 4 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="La plantilla no puede superar 4 MB")
    try:
        return RentaService.import_configurations(db, content)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        db.rollback()
        raise


@router.post("/generar")
def generate_rentas(
    periodo: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    return RentaService.generate(db, periodo)


@router.post("/{renta_id}/pagos", status_code=201)
def create_pago(renta_id: int, payload: RentaPagoCreate, db: Session = Depends(get_db)):
    return RentaService.add_payment(db, renta_id, payload.model_dump())
