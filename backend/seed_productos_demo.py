"""Idempotent demo products for trying inventory, QR scanning, and POS flows."""
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.inventario import Producto
from app.models.marcas import Marca


DEMO_PRODUCTS = [
    {
        "sku": "DEMO-LUN-001",
        "nombre": "DEMO - Scrunchie satinado rosa",
        "descripcion": "Producto de demostracion para probar QR, cobro y descuento de stock.",
        "tamano": "Unitalla / rosa",
        "precio": Decimal("4.50"),
        "stock_inicial": 12,
        "stock_critico": 3,
    },
    {
        "sku": "DEMO-LUN-002",
        "nombre": "DEMO - Scrunchie estampado floral",
        "descripcion": "Producto de demostracion para pruebas del punto de venta.",
        "tamano": "Unitalla / floral",
        "precio": Decimal("4.75"),
        "stock_inicial": 8,
        "stock_critico": 2,
    },
    {
        "sku": "DEMO-LUN-003",
        "nombre": "DEMO - Libreta personalizada A5",
        "descripcion": "Producto de demostracion para probar facturacion y existencias.",
        "tamano": "A5",
        "precio": Decimal("8.00"),
        "stock_inicial": 6,
        "stock_critico": 2,
    },
    {
        "sku": "DEMO-LUN-004",
        "nombre": "DEMO - Set de papeleria creativa",
        "descripcion": "Producto de demostracion para pruebas. Incluye detalles personalizables.",
        "tamano": "Set",
        "precio": Decimal("6.50"),
        "stock_inicial": 10,
        "stock_critico": 2,
    },
]


def seed_demo_products():
    db = SessionLocal()
    try:
        brand = db.query(Marca).filter(Marca.codigo == "LUN").first()
        if not brand:
            raise RuntimeError("No se encontro la marca Lunera (codigo LUN).")

        created = 0
        for item in DEMO_PRODUCTS:
            exists = db.query(Producto.id).filter(Producto.sku == item["sku"]).first()
            if exists:
                continue
            db.add(Producto(
                **item,
                marca_id=brand.id,
                codigo_qr=f"BHPOS-{item['sku']}",
                estado_id=1,
            ))
            created += 1
        db.commit()
        print(f"Productos demo nuevos: {created}; catalogo demo verificado.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_products()
