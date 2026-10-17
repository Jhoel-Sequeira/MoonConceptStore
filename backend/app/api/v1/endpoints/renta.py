from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.renta import Renta, RentaPago
from app.models.marcas import Marca
from app.schemas.renta import RentaCreate, RentaPagoCreate

router = APIRouter()


@router.get("/")
def list_rentas(db: Session = Depends(get_db)):
    rows = db.query(Renta).options(joinedload(Renta.marca), joinedload(Renta.pagos)).order_by(Renta.fecha_pago.desc()).all()
    return [{
        "id": row.id,
        "marca_id": row.marca_id,
        "marca": row.marca.nombre_marca if row.marca else "Marca eliminada",
        "fecha_pago": row.fecha_pago,
        "monto": row.monto or 0,
        "pagado": sum(p.monto_pagado or 0 for p in row.pagos),
        "pagos": [{"pago_id": p.pago_id, "monto_pagado": p.monto_pagado, "fecha_pago": p.fecha_pago, "comentario": p.comentario} for p in row.pagos],
    } for row in rows]


@router.post("/", status_code=201)
def create_renta(payload: RentaCreate, db: Session = Depends(get_db)):
    if not db.query(Marca).filter(Marca.id == payload.marca_id).first():
        raise HTTPException(status_code=404, detail="Marca no encontrada")
    row = Renta(**payload.dict())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@router.post("/{renta_id}/pagos", status_code=201)
def create_pago(renta_id: int, payload: RentaPagoCreate, db: Session = Depends(get_db)):
    row = db.query(Renta).filter(Renta.id == renta_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Renta no encontrada")
    paid = sum(p.monto_pagado or 0 for p in db.query(RentaPago).filter(RentaPago.renta_id == renta_id).all())
    if paid + payload.monto_pagado > (row.monto or 0):
        raise HTTPException(status_code=400, detail="El pago supera el saldo pendiente")
    payment = RentaPago(renta_id=renta_id, **payload.dict())
    db.add(payment)
    db.commit()
    return {"status": "ok"}
