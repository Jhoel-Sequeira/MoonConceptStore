from typing import Literal, Optional

from pydantic import BaseModel, Field


UserRole = Literal[
    "Administrador General",
    "Cajero / Operador POS",
    "Gestor de Marca",
    "Auditor de Inventario",
]


class UserCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    usuario: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=72)
    rol: UserRole


class UserUpdate(BaseModel):
    nombre: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    usuario: str = Field(min_length=3, max_length=100)
    rol: UserRole
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)


class UserStatusUpdate(BaseModel):
    active: bool
