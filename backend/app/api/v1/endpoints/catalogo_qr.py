from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_catalogo_qr():
    return {"status": "ok", "modulo": "Catálogo y Generador QR"}
