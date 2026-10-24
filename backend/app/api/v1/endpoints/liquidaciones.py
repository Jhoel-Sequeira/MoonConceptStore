from urllib.parse import quote

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.usuarios import Usuario
from app.schemas.liquidaciones import LiquidacionPagoCreate
from app.services.liquidaciones_service import LiquidacionesService


router = APIRouter()


@router.get("/marca/{marca_id}/excel")
def export_brand_settlement_excel(
    marca_id: int = Path(gt=0),
    periodo: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    content, filename = LiquidacionesService.generate_brand_excel(db, marca_id, periodo)
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.get("/reporte")
def get_report(
    periodo: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    return LiquidacionesService.report(db, periodo)


@router.get("/")
def get_liquidaciones(
    periodo: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    return LiquidacionesService.list_for_period(db, periodo)


@router.post("/generar")
def generate_liquidaciones(
    periodo: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    return LiquidacionesService.generate(db, periodo)


@router.post("/{liquidacion_id}/pagar")
def mark_paid(
    liquidacion_id: int,
    payment: LiquidacionPagoCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    return LiquidacionesService.mark_paid(db, liquidacion_id, payment.fecha_pago, payment.referencia_pago)
