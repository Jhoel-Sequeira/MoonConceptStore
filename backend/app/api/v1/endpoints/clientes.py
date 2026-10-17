from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_clientes():
    return {"status": "ok", "modulo": "Gestión de Clientes"}
