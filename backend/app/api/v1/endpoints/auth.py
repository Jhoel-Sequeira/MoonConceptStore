from datetime import datetime, timedelta, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import OperationalError

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.usuarios import Usuario

router = APIRouter()
logger = logging.getLogger(__name__)
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


@router.post("/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    try:
        identifier = credentials.email.strip()
        user = db.query(Usuario).filter(
            or_(Usuario.email.ilike(identifier), Usuario.usuario.ilike(identifier))
        ).first()
    except OperationalError as exc:
        logger.error("Falló la consulta de usuarios durante el login: %s", exc.orig)
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


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if len(request.current_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual es incorrecta.")
    if len(request.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="La nueva contraseña no puede superar 72 bytes UTF-8.")
    user = db.query(Usuario).filter(Usuario.id == current_user.id).with_for_update().populate_existing().first()
    if user is None or user.estado_id != 4:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="La sesión no es válida o expiró.")
    if not password_context.verify(request.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual es incorrecta.")
    if password_context.verify(request.new_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La nueva contraseña debe ser diferente a la actual.")

    user.password_hash = password_context.hash(request.new_password)
    db.commit()
    return {"message": "La contraseña se actualizó correctamente."}
