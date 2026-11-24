from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.usuarios import Usuario
from app.schemas.clientes import AbonoClienteCreate, ClienteCreate, ClienteUpdate
from app.services.clientes_service import ClientesService

router = APIRouter()


@router.get("/")
def get_clientes(
    buscar: str | None = Query(default=None, max_length=100),
    limite: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return ClientesService.get_all(db, buscar, limite)


@router.get("/{cliente_id}")
def get_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = ClientesService.get_by_id(db, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return cliente


@router.get("/{cliente_id}/cuentas")
def get_cuentas_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = ClientesService.get_by_id(db, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return {
        "saldo_pendiente": cliente["saldo_pendiente"],
        "cuentas": ClientesService.get_credit_accounts(db, cliente_id),
    }


@router.post("/{cliente_id}/abonos", status_code=status.HTTP_201_CREATED)
def registrar_abono(
    cliente_id: int,
    data: AbonoClienteCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return ClientesService.register_payment(db, cliente_id, data, current_user.id)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_cliente(data: ClienteCreate, db: Session = Depends(get_db)):
    try:
        return ClientesService.create(db, data)
    except Exception:
        db.rollback()
        raise


@router.put("/{cliente_id}")
def update_cliente(cliente_id: int, data: ClienteUpdate, db: Session = Depends(get_db)):
    try:
        return ClientesService.update(db, cliente_id, data)
    except Exception:
        db.rollback()
        raise
