from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class CuentaBase(BaseModel):
    banco: Optional[str] = None
    no_cuenta: Optional[str] = None

class CuentaCreate(CuentaBase):
    pass

class CuentaResponse(CuentaBase):
    id: int
    marca_id: Optional[int] = None

    class Config:
        from_attributes = True

class MarcaBase(BaseModel):
    nombre_marca: str
    cedula: Optional[str] = None
    codigo: Optional[str] = None
    categoria: Optional[str] = None
    razon_social: Optional[str] = None
    ciudad_pais: Optional[str] = None
    redes_sociales: Optional[str] = None
    nombre_representante: Optional[str] = None
    cargo: Optional[str] = None
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    tiempo_estancia: Optional[float] = 6.0
    fecha_ingreso: Optional[datetime] = None
    catalogo: Optional[str] = None
    estado_id: int = 2
    logo: Optional[str] = None

class MarcaCreate(MarcaBase):
    banco: Optional[str] = None
    no_cuenta: Optional[str] = None

class MarcaUpdate(BaseModel):
    nombre_marca: Optional[str] = None
    cedula: Optional[str] = None
    codigo: Optional[str] = None
    categoria: Optional[str] = None
    razon_social: Optional[str] = None
    ciudad_pais: Optional[str] = None
    redes_sociales: Optional[str] = None
    nombre_representante: Optional[str] = None
    cargo: Optional[str] = None
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    tiempo_estancia: Optional[float] = None
    fecha_ingreso: Optional[datetime] = None
    catalogo: Optional[str] = None
    estado_id: Optional[int] = None
    logo: Optional[str] = None
    banco: Optional[str] = None
    no_cuenta: Optional[str] = None

class MarcaResponse(MarcaBase):
    id: int
    cuentas: Optional[int] = None
    fecha_registro: Optional[datetime] = None
    banco: Optional[str] = None
    no_cuenta: Optional[str] = None
    cuentas_bancarias: List[CuentaResponse] = []
    activeSkus: Optional[str] = "0 SKUs"
    monthSales: Optional[float] = 0.0

    class Config:
        from_attributes = True
