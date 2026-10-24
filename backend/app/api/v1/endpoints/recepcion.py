from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse
import io

from app.core.database import get_db
from app.services.recepcion_service import RecepcionService

router = APIRouter()


@router.get("/")
def get_recepcion(db: Session = Depends(get_db)):
    return RecepcionService.get_all(db)


@router.get("/{ingreso_id}/qr-pdf")
def download_recepcion_qr_pdf(ingreso_id: int, db: Session = Depends(get_db)):
    result = RecepcionService.generate_qr_pdf(db, ingreso_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No se encontró la importación solicitada.")
    pdf, product_count = result
    if not product_count:
        raise HTTPException(status_code=404, detail="Esta importación no tiene productos para generar códigos QR.")
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="QR_Recepcion_{ingreso_id}.pdf"',
            "X-Productos-QR": str(product_count),
        },
    )


@router.get("/{ingreso_id}")
def get_recepcion_detail(ingreso_id: int, db: Session = Depends(get_db)):
    ingreso = RecepcionService.get_detail(db, ingreso_id)
    if not ingreso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró la importación solicitada",
        )
    return ingreso
