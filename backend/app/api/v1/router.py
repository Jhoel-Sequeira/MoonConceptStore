from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.v1.endpoints import (
    admin,
    auth,
    bajas_retiros,
    catalogo_qr,
    cierre_caja,
    clientes,
    dashboard,
    inventario,
    liquidaciones,
    marcas,
    pos,
    recepcion,
    renta,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])

protected = {"dependencies": [Depends(get_current_user)]}
api_router.include_router(admin.router, prefix="/admin", tags=["Administración"], **protected)
api_router.include_router(marcas.router, prefix="/marcas", tags=["Gestión de Marcas"], **protected)
api_router.include_router(clientes.router, prefix="/clientes", tags=["Gestión de Clientes"], **protected)
api_router.include_router(inventario.router, prefix="/inventario", tags=["Inventario"], **protected)
api_router.include_router(catalogo_qr.router, prefix="/catalogo-qr", tags=["Catálogo y Generador QR"], **protected)
api_router.include_router(recepcion.router, prefix="/recepcion", tags=["Recepción e Ingreso"], **protected)
api_router.include_router(bajas_retiros.router, prefix="/bajas-retiros", tags=["Bajas y Retiros"], **protected)
api_router.include_router(pos.router, prefix="/pos", tags=["Punto de Venta"], **protected)
api_router.include_router(cierre_caja.router, prefix="/cierre-caja", tags=["Cierre de Caja"], **protected)
api_router.include_router(liquidaciones.router, prefix="/liquidaciones", tags=["Liquidaciones"], **protected)
api_router.include_router(renta.router, prefix="/renta", tags=["Renta"], **protected)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"], **protected)
