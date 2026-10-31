from datetime import date, datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field
from pydantic import validator


class ClienteCreate(BaseModel):
    nombre_cliente: str = Field(min_length=1, max_length=255)
    telefono: str | None = Field(default=None, max_length=50)
    correo: str | None = Field(default=None, max_length=255)
    fecha_nacimiento: date | None = None

    @validator("fecha_nacimiento")
    def validate_birth_date(cls, value):
        if value and value > datetime.now(ZoneInfo("America/Managua")).date():
            raise ValueError("La fecha de nacimiento no puede ser futura.")
        return value


class ClienteUpdate(ClienteCreate):
    pass
