from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.usuarios import Usuario
from app.schemas.admin import UserCreate, UserStatusUpdate, UserUpdate
from app.services.admin_service import AdminService, is_administrator


router = APIRouter()


def require_admin(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    if not is_administrator(current_user.rol):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol de administrador.")
    return current_user


@router.get("/")
def list_users(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    return AdminService.list_users(db)


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    try:
        return AdminService.create_user(db, user_in)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    try:
        return AdminService.update_user(db, user_id, user_in, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/users/{user_id}/status")
def set_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
):
    try:
        return AdminService.set_user_active(db, user_id, status_in.active, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
