from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class VentaItemCreate(BaseModel):
    producto_id: int = Field(gt=0)
    cantidad: int = Field(gt=0, le=100000)
    precio_unitario: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    descuento_unitario: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    descuento_porcentaje: Decimal = Field(default=Decimal("0"), ge=0, le=100, max_digits=5, decimal_places=2)


class VentaCreate(BaseModel):
    cliente_id: Optional[int] = Field(default=None, gt=0)
    cliente: Optional[str] = Field(default=None, max_length=255)
    metodo_pago: str = Field(min_length=1, max_length=100)
    items: List[VentaItemCreate] = Field(min_length=1, max_length=100)


class VentaDetalleResponse(BaseModel):
    producto_id: int
    sku: str
    nombre: str
    cantidad: int
    precio_unitario: Decimal
    descuento: Decimal
    subtotal: Decimal


class VentaResponse(BaseModel):
    id: int
    fecha_venta: str
    cliente: str
    metodo_pago: str
    subtotal: Decimal
    subtotal_bruto: Decimal
    descuento_total: Decimal
    comision_pos: Decimal
    total: Decimal
    items: List[VentaDetalleResponse]


class POSCommissionConfig(BaseModel):
    comision_tarjeta_porcentaje: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
