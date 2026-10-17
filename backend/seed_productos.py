"""
Seed de productos y kardex inicial de prueba para BrandHub POS
"""
from app.core.database import SessionLocal
from app.models.marcas import Marca
from app.models.inventario import Producto, Kardex
from decimal import Decimal

def seed_productos():
    db = SessionLocal()
    try:
        if db.query(Producto).count() > 0:
            print("Los productos ya existen en la base de datos.")
            return

        marcas = {m.nombre_marca: m for m in db.query(Marca).all()}
        if not marcas:
            print("No se encontraron marcas registradas. Ejecuta primero seed_marcas.py.")
            return

        # Buscar o mapear a las marcas que existen
        nordic = marcas.get("Nordic Home") or list(marcas.values())[0]
        vera = marcas.get("Vera Studio") or list(marcas.values())[min(1, len(marcas)-1)]
        aura = marcas.get("Aura Botanics") or list(marcas.values())[min(2, len(marcas)-1)]
        komorebi = marcas.get("Komorebi Crafts") or list(marcas.values())[min(3, len(marcas)-1)]

        items = [
            {
                "sku": "NH-089",
                "nombre": "Taza Cerámica Matte",
                "descripcion": "Acabado Negro Satinado 350ml",
                "marca_id": nordic.id,
                "precio": Decimal("24.00"),
                "stock_critico": 5,
                "stock_inicial": 18,
                "codigo_qr": "BHPOS-NH-089"
            },
            {
                "sku": "NH-115",
                "nombre": "Vela Aromática Soja 200g",
                "descripcion": "Aroma Cedro & Vainilla",
                "marca_id": nordic.id,
                "precio": Decimal("19.50"),
                "stock_critico": 6,
                "stock_inicial": 30,
                "codigo_qr": "BHPOS-NH-115"
            },
            {
                "sku": "VS-204",
                "nombre": "Chaqueta Lino Crudo (M)",
                "descripcion": "Corte Regular Fit · Colección SS24",
                "marca_id": vera.id,
                "precio": Decimal("120.00"),
                "stock_critico": 5,
                "stock_inicial": 5,
                "codigo_qr": "BHPOS-VS-204"
            },
            {
                "sku": "AB-112",
                "nombre": "Aceite Botánico Reparador 50ml",
                "descripcion": "Prensado en frío · Argán & Jojoba",
                "marca_id": aura.id,
                "precio": Decimal("38.00"),
                "stock_critico": 8,
                "stock_inicial": 24,
                "codigo_qr": "BHPOS-AB-112"
            },
            {
                "sku": "LT-401",
                "nombre": "Funda Cojín Chenille 45x45",
                "descripcion": "Color Terracota Suave",
                "marca_id": komorebi.id,
                "precio": Decimal("32.00"),
                "stock_critico": 4,
                "stock_inicial": 12,
                "codigo_qr": "BHPOS-LT-401"
            },
            {
                "sku": "SL-019",
                "nombre": "Portadocumentos Cuero Café",
                "descripcion": "Piel Vacuna Genuina Hecha a Mano",
                "marca_id": komorebi.id,
                "precio": Decimal("55.00"),
                "stock_critico": 3,
                "stock_inicial": 8,
                "codigo_qr": "BHPOS-SL-019"
            },
            {
                "sku": "VS-205",
                "nombre": "Pantalón Lino Arena (L)",
                "descripcion": "Cintura Elasticada con Cordón",
                "marca_id": vera.id,
                "precio": Decimal("95.00"),
                "stock_critico": 5,
                "stock_inicial": 14,
                "codigo_qr": "BHPOS-VS-205"
            }
        ]

        for item in items:
            stock_ini = item.pop("stock_inicial")
            prod = Producto(**item)
            db.add(prod)
            db.commit()
            db.refresh(prod)

            kardex = Kardex(
                producto_id=prod.id,
                usuario_id=1,
                tipo_movimiento="INGRESO",
                cantidad=stock_ini,
                motivo="Inventario Inicial Sembrado"
            )
            db.add(kardex)
            db.commit()

        print(f"Sembrados exitosamente {len(items)} productos con su stock inicial en Kardex.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_productos()
