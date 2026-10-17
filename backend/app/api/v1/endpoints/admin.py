from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_admin():
    return {"status": "ok", "modulo": "Administración"}
