from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_cierre_caja():
    return {"status": "ok", "modulo": "Cierre de Caja"}
