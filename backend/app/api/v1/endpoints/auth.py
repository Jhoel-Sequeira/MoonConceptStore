from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import get_db
from app.models.usuarios import Usuario

router = APIRouter()
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    try:
        identifier = credentials.email.strip()
        user = db.query(Usuario).filter(
            or_(Usuario.email.ilike(identifier), Usuario.usuario.ilike(identifier))
        ).first()
    except OperationalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No hay conexión con la base de datos. Revisa DATABASE_URL en backend/.env y reinicia el backend.",
        ) from exc
    if (
        user is None
        or user.estado_id != 4
        or not password_context.verify(credentials.password, user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Correo o contraseña incorrectos.")

    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    access_token = jwt.encode(
        {"sub": str(user.id), "exp": expires_at},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "nombre": user.nombre,
            "email": user.email,
            "usuario": user.usuario,
            "rol": user.rol,
        },
    }
