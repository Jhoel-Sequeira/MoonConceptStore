from urllib.parse import quote
from datetime import date
import io

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
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
    periodo: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    marca_ids: list[int] | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    if periodo and (desde or hasta):
        raise HTTPException(status_code=422, detail="Usa un mes o un rango de fechas, no ambos.")
    return LiquidacionesService.report(db, periodo, desde=desde, hasta=hasta, brand_ids=marca_ids)


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


@router.post("/generar-exportar")
def generate_and_export_liquidaciones(
    periodo: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    marca_ids: list[int] = Body(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    content, filename, exported, skipped = LiquidacionesService.generate_and_export(db, periodo, marca_ids)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "X-Marcas-Exportadas": str(exported),
            "X-Marcas-Sin-Ventas": str(skipped),
        },
    )


@router.post("/{liquidacion_id}/pagar")
def mark_paid(
    liquidacion_id: int,
    payment: LiquidacionPagoCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    return LiquidacionesService.mark_paid(db, liquidacion_id, payment.fecha_pago, payment.referencia_pago)
