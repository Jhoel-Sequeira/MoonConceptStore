from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class RentaConfigUpsert(BaseModel):
    marca_id: int = Field(gt=0)
    monto_mensual: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    dia_vencimiento: int = Field(default=1, ge=1, le=31)
    fecha_inicio: date
    fecha_fin: date | None = None
    activa: bool = True


class RentaPagoCreate(BaseModel):
    monto_pagado: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    fecha_pago: date
    referencia_pago: str = Field(min_length=1, max_length=255)
    comentario: str | None = Field(default=None, max_length=1000)
