from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_liquidaciones():
    return {"status": "ok", "modulo": "Liquidaciones"}
