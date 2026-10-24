from datetime import date

from pydantic import BaseModel, Field


class LiquidacionPagoCreate(BaseModel):
    fecha_pago: date
    referencia_pago: str = Field(min_length=1, max_length=255)
