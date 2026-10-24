from pydantic import BaseModel, Field


class ClienteCreate(BaseModel):
    nombre_cliente: str = Field(min_length=1, max_length=255)
    telefono: str | None = Field(default=None, max_length=50)
    correo: str | None = Field(default=None, max_length=255)


class ClienteUpdate(ClienteCreate):
    pass
