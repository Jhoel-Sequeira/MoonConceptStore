from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class ProductoBase(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    nombre: str = Field(min_length=1, max_length=255)
    marca_id: int = Field(gt=0)
    precio: float = Field(gt=0, le=9999999999.99)
    descripcion: Optional[str] = Field(default=None, max_length=10000)
    tamano: Optional[str] = Field(default=None, max_length=255)
    stock_critico: Optional[int] = Field(default=5, ge=0, le=2147483647)
    imagen_url: Optional[str] = Field(default=None, max_length=2000)
    imagenes: List[str] = Field(default_factory=list, max_length=10)
    estado_id: Optional[int] = 1

class ProductoCreate(ProductoBase):
    stock_inicial: Optional[int] = Field(default=0, ge=0, le=2147483647)

class ProductoUpdate(BaseModel):
    sku: Optional[str] = Field(default=None, min_length=1, max_length=100)
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=255)
    marca_id: Optional[int] = Field(default=None, gt=0)
    precio: Optional[float] = Field(default=None, gt=0, le=9999999999.99)
    descripcion: Optional[str] = Field(default=None, max_length=10000)
    tamano: Optional[str] = Field(default=None, max_length=255)
    stock_critico: Optional[int] = Field(default=None, ge=0, le=2147483647)
    imagen_url: Optional[str] = Field(default=None, max_length=2000)
    imagenes: Optional[List[str]] = Field(default=None, max_length=10)
    estado_id: Optional[int] = None
    stock_actual: Optional[int] = Field(default=None, ge=0, le=2147483647)

class ProductoResponse(BaseModel):
    id: int
    sku: str
    nombre: str
    descripcion: Optional[str] = None
    tamano: Optional[str] = None
    precio: float
    stock_critico: Optional[int] = 5
    imagen_url: Optional[str] = None
    imagenes: List[str] = Field(default_factory=list)
    estado_id: Optional[int] = 1
    codigo_qr: Optional[str] = None
    qr_image_url: Optional[str] = None
    marca_id: int
    marca_nombre: Optional[str] = None
    marca_codigo: Optional[str] = None
    stock_actual: int = 0
    qr_status: str = "Generado"

    class Config:
        from_attributes = True

class InventarioStats(BaseModel):
    total_skus: int
    total_stock_unidades: int
    skus_bajo_stock: int
    total_valor_inventario: float
