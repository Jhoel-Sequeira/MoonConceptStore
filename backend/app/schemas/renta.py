from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RentaCreate(BaseModel):
    marca_id: int
    fecha_pago: datetime
    monto: float = Field(gt=0)


class RentaPagoCreate(BaseModel):
    monto_pagado: float = Field(gt=0)
    fecha_pago: datetime
    comentario: Optional[str] = None
