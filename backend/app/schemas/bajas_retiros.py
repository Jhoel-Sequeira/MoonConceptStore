from typing import List

from pydantic import BaseModel, Field


class RetiroProductoCreate(BaseModel):
    producto_id: int = Field(gt=0)
    cantidad: int = Field(gt=0, le=100000)


class RetiroCreate(BaseModel):
    marca_id: int = Field(gt=0)
    motivo: str = Field(min_length=3, max_length=2000)
    productos: List[RetiroProductoCreate] = Field(min_length=1, max_length=200)
