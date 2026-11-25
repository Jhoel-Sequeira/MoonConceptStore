import re
import unicodedata

from passlib.context import CryptContext
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.usuarios import Usuario
from app.schemas.admin import UserCreate, UserRole, UserUpdate


password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
AVAILABLE_ROLES: list[UserRole] = [
    "Administrador General",
    "Cajero / Operador POS",
    "Gestor de Marca",
    "Auditor de Inventario",
]


def normalize_role(role: str) -> str:
    decomposed = unicodedata.normalize("NFKD", role).casefold()
    return "".join(character for character in decomposed if not unicodedata.combining(character))


def is_administrator(role: str) -> bool:
    normalized = normalize_role(role)
    return "admin" in normalized or "administrador" in normalized


class AdminService:
    @staticmethod
    def _status_id(db: Session, active: bool, create_missing: bool = False) -> int:
        status_name = "Activo" if active else "Inactivo"
        status_id = db.execute(
            text("SELECT id FROM estados WHERE modulo = 'usuarios' AND lower(nombre) = lower(:name) ORDER BY id LIMIT 1"),
            {"name": status_name},
        ).scalar()
        if status_id is not None:
            return int(status_id)
        if not create_missing:
            raise ValueError("No está configurado el estado Activo para usuarios.")
        return int(db.execute(
            text("INSERT INTO estados (modulo, nombre, descripcion) VALUES ('usuarios', :name, :description) RETURNING id"),
            {"name": status_name, "description": "Usuario habilitado" if active else "Usuario deshabilitado por administración"},
        ).scalar_one())

    @staticmethod
    def _validate_email(email: str) -> str:
        normalized = email.strip().lower()
        if not EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("Escribe un correo electrónico válido.")
        return normalized

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("La contraseña no puede superar 72 bytes UTF-8.")

    @staticmethod
    def _serialize(user: Usuario, active_status_id: int) -> dict:
        return {
            "id": user.id,
            "nombre": user.nombre,
            "email": user.email,
            "usuario": user.usuario,
            "rol": user.rol,
            "estado_id": user.estado_id,
            "estado": "Activo" if user.estado_id == active_status_id else "Inactivo",
            "creado_en": user.creado_en.isoformat() if user.creado_en else None,
        }

    @classmethod
    def list_users(cls, db: Session) -> dict:
        active_status_id = cls._status_id(db, active=True)
        users = db.query(Usuario).order_by(Usuario.id.desc()).all()
        serialized = [cls._serialize(user, active_status_id) for user in users]
        return {
            "users": serialized,
            "total": len(serialized),
            "active": sum(user["estado_id"] == active_status_id for user in serialized),
            "roles": AVAILABLE_ROLES,
        }

    @classmethod
    def create_user(cls, db: Session, data: UserCreate) -> dict:
        name = data.nombre.strip()
        username = data.usuario.strip().lower()
        email = cls._validate_email(data.email)
        cls._validate_password(data.password)
        if not name:
            raise ValueError("El nombre es obligatorio.")
        if not re.fullmatch(r"[a-zA-Z0-9._-]{3,100}", username):
            raise ValueError("El usuario solo puede contener letras, números, punto, guion y guion bajo.")
        duplicate = db.query(Usuario.id).filter(
            or_(func.lower(Usuario.email) == email, func.lower(Usuario.usuario) == username)
        ).first()
        if duplicate:
            raise ValueError("Ya existe un usuario con ese correo o nombre de usuario.")
        active_status_id = cls._status_id(db, active=True)
        user = Usuario(
            nombre=name,
            email=email,
            usuario=username,
            password_hash=password_context.hash(data.password),
            rol=data.rol,
            estado_id=active_status_id,
        )
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except IntegrityError as exc:
            db.rollback()
            raise ValueError("Ya existe un usuario con ese correo o nombre de usuario.") from exc
        return cls._serialize(user, active_status_id)

    @classmethod
    def update_user(cls, db: Session, user_id: int, data: UserUpdate, actor: Usuario) -> dict:
        user = db.query(Usuario).filter(Usuario.id == user_id).with_for_update().first()
        if not user:
            raise LookupError("No se encontró el usuario.")
        active_status_id = cls._status_id(db, active=True)
        new_email = cls._validate_email(data.email)
        new_username = data.usuario.strip().lower()
        if not re.fullmatch(r"[a-zA-Z0-9._-]{3,100}", new_username):
            raise ValueError("El usuario solo puede contener letras, números, punto, guion y guion bajo.")
        duplicate = db.query(Usuario.id).filter(
            Usuario.id != user_id,
            or_(func.lower(Usuario.email) == new_email, func.lower(Usuario.usuario) == new_username),
        ).first()
        if duplicate:
            raise ValueError("Ya existe un usuario con ese correo o nombre de usuario.")
        if data.password:
            cls._validate_password(data.password)
        if actor.id == user.id and is_administrator(user.rol) and not is_administrator(data.rol):
            raise ValueError("No puedes quitarte tu propio rol de administrador.")
        if user.estado_id == active_status_id and is_administrator(user.rol) and not is_administrator(data.rol):
            cls._ensure_another_active_admin(db, user.id, active_status_id)

        user.nombre = data.nombre.strip()
        if not user.nombre:
            raise ValueError("El nombre es obligatorio.")
        user.email = new_email
        user.usuario = new_username
        user.rol = data.rol
        if data.password:
            user.password_hash = password_context.hash(data.password)
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError as exc:
            db.rollback()
            raise ValueError("Ya existe un usuario con ese correo o nombre de usuario.") from exc
        return cls._serialize(user, active_status_id)

    @classmethod
    def set_user_active(cls, db: Session, user_id: int, active: bool, actor: Usuario) -> dict:
        user = db.query(Usuario).filter(Usuario.id == user_id).with_for_update().first()
        if not user:
            raise LookupError("No se encontró el usuario.")
        active_status_id = cls._status_id(db, active=True)
        if active:
            user.estado_id = active_status_id
        else:
            if actor.id == user.id:
                raise ValueError("No puedes desactivar tu propia cuenta.")
            if user.estado_id == active_status_id and is_administrator(user.rol):
                cls._ensure_another_active_admin(db, user.id, active_status_id)
            user.estado_id = cls._status_id(db, active=False, create_missing=True)
        db.commit()
        db.refresh(user)
        return cls._serialize(user, active_status_id)

    @staticmethod
    def _ensure_another_active_admin(db: Session, excluded_user_id: int, active_status_id: int) -> None:
        db.execute(text("SELECT pg_advisory_xact_lock(733105842)"))
        active_admin_count = db.query(func.count(Usuario.id)).filter(
            Usuario.estado_id == active_status_id,
            Usuario.id != excluded_user_id,
            func.lower(Usuario.rol).like("%admin%"),
        ).scalar() or 0
        if active_admin_count == 0:
            raise ValueError("Debe quedar al menos un administrador activo en el sistema.")
