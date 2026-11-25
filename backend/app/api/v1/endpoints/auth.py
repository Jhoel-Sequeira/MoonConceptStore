from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from hashlib import sha256
import logging
import secrets
import smtplib
import ssl
from urllib.parse import quote, urlsplit

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import get_db
from app.models.usuarios import Usuario
from app.models.password_reset import PasswordResetToken

router = APIRouter()
logger = logging.getLogger(__name__)
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    email: str
    password: str


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=8, max_length=72)


RESET_REQUEST_MESSAGE = "Si el correo está registrado, recibirás un enlace para restablecer la contraseña."


def _send_password_reset(email: str, token: str) -> None:
    message = EmailMessage()
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={quote(token)}"
    message["Subject"] = "Restablece tu contraseña"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        "Recibimos una solicitud para restablecer tu contraseña. "
        f"Abre este enlace dentro de 30 minutos: {reset_url}\n\n"
        "Si no solicitaste este cambio, ignora este mensaje."
    )
    context = ssl.create_default_context()
    if settings.SMTP_USE_SSL:
        server_connection = smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=15, context=context,
        )
    else:
        server_connection = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
    with server_connection as server:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            server.starttls(context=context)
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)


def _smtp_ready() -> bool:
    frontend_url = urlsplit(settings.FRONTEND_URL or "")
    return bool(
        frontend_url.scheme in {"http", "https"} and frontend_url.netloc
        and settings.SMTP_HOST and settings.SMTP_FROM_EMAIL
        and bool(settings.SMTP_USERNAME) == bool(settings.SMTP_PASSWORD)
        and (settings.SMTP_USE_TLS != settings.SMTP_USE_SSL)
    )


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
        {"sub": str(user.id), "ver": user.auth_version, "exp": expires_at},
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


@router.post("/password-reset/request")
def request_password_reset(request: PasswordResetRequest, db: Session = Depends(get_db)):
    if not _smtp_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El restablecimiento por correo aún no está configurado.",
        )

    now = datetime.now(timezone.utc)
    user = db.query(Usuario).filter(func.lower(Usuario.email) == request.email.strip().lower()).with_for_update().first()
    if user is None or user.estado_id != 4:
        return {"message": RESET_REQUEST_MESSAGE}

    latest = db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id
    ).order_by(PasswordResetToken.created_at.desc()).first()
    if latest and (now - latest.created_at).total_seconds() < 60:
        return {"message": RESET_REQUEST_MESSAGE}

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: now}, synchronize_session=False)
    raw_token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=sha256(raw_token.encode("utf-8")).hexdigest(),
        created_at=now,
        expires_at=now + timedelta(minutes=30),
    ))
    db.commit()
    try:
        _send_password_reset(user.email, raw_token)
    except Exception:
        logger.exception("No se pudo enviar el correo de restablecimiento de contraseña.")
        return {"message": RESET_REQUEST_MESSAGE}
    return {"message": RESET_REQUEST_MESSAGE}


@router.post("/password-reset/confirm")
def confirm_password_reset(request: PasswordResetConfirm, db: Session = Depends(get_db)):
    if len(request.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="La contraseña no puede superar 72 bytes UTF-8.")

    now = datetime.now(timezone.utc)
    token_hash = sha256(request.token.encode("utf-8")).hexdigest()
    candidate_user_id = db.query(PasswordResetToken.user_id).filter(
        PasswordResetToken.token_hash == token_hash,
    ).scalar()
    if candidate_user_id is None:
        raise HTTPException(status_code=400, detail="El enlace no es válido o venció. Solicita uno nuevo.")

    user = db.query(Usuario).filter(Usuario.id == candidate_user_id).with_for_update().first()
    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now,
    ).with_for_update().first()
    if reset is None or user is None or user.estado_id != 4:
        raise HTTPException(status_code=400, detail="El enlace no es válido o venció. Solicita uno nuevo.")
    user.password_hash = password_context.hash(request.password)
    user.auth_version += 1
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: now}, synchronize_session=False)
    db.commit()
    return {"message": "La contraseña se restableció correctamente. Inicia sesión con tu nueva contraseña."}
