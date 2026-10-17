from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class VentaItemCreate(BaseModel):
    producto_id: int = Field(gt=0)
    cantidad: int = Field(gt=0, le=100000)


class VentaCreate(BaseModel):
    cliente: str = Field(default="Consumidor Final", min_length=1, max_length=255)
    metodo_pago: str = Field(min_length=1, max_length=100)
    items: List[VentaItemCreate] = Field(min_length=1, max_length=100)


class VentaDetalleResponse(BaseModel):
    producto_id: int
    sku: str
    nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class VentaResponse(BaseModel):
    id: int
    fecha_venta: str
    cliente: str
    metodo_pago: str
    total: Decimal
    items: List[VentaDetalleResponse]
