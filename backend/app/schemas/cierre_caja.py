from decimal import Decimal

from pydantic import BaseModel, Field


class CierreCajaCreate(BaseModel):
    fondo_inicial: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    contado_efectivo: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    contado_tarjeta: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    contado_transferencia: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    observaciones: str | None = Field(default=None, max_length=2000)
