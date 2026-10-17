from app.core.database import SessionLocal
from app.services.marcas_service import MarcasService
from app.schemas.marcas import MarcaCreate
from datetime import datetime

INITIAL_BRANDS = [
    {
        "nombre_marca": "Nordic Home",
        "codigo": "NDH",
        "categoria": "Hogar & Deco",
        "razon_social": "Nordic Home S.A.",
        "ciudad_pais": "Managua, Nicaragua",
        "redes_sociales": "@nordichome.ni",
        "nombre_representante": "Elena Müller",
        "cargo": "Gerente General",
        "contacto_nombre": "Elena Müller",
        "telefono": "+505 8765 4321",
        "email": "elena@nordichome.design",
        "fecha_ingreso": datetime(2024, 1, 15),
        "tiempo_estancia": 12,
        "catalogo": "https://nordichome.design/catalogo.pdf",
        "estado_id": 1,
        "banco": "BAC Credomatic",
        "no_cuenta": "362-819-283",
    },
    {
        "nombre_marca": "Vera Studio",
        "codigo": "VRA",
        "categoria": "Moda Sostenible",
        "razon_social": "Vera Studio S.A.",
        "ciudad_pais": "San José, Costa Rica",
        "redes_sociales": "@verastudio",
        "nombre_representante": "Lucas Vera",
        "cargo": "Director Creativo",
        "contacto_nombre": "Lucas Vera",
        "telefono": "+506 2345 6789",
        "email": "lucas@verastudio.ar",
        "fecha_ingreso": datetime(2024, 2, 1),
        "tiempo_estancia": 6,
        "catalogo": "https://verastudio.ar/catalogo.pdf",
        "estado_id": 1,
        "banco": "Banco Lafise",
        "no_cuenta": "102-938-475",
    },
    {
        "nombre_marca": "Aura Botanics",
        "codigo": "AUR",
        "categoria": "Cosmética Orgánica",
        "razon_social": "Aura Botanics Cía.",
        "ciudad_pais": "Managua, Nicaragua",
        "redes_sociales": "@aurabotanics",
        "nombre_representante": "Mariana Solís",
        "cargo": "Fundadora",
        "contacto_nombre": "Mariana Solís",
        "telefono": "+505 4433 2211",
        "email": "marianasolis@aurabotanics.com",
        "fecha_ingreso": datetime(2024, 3, 10),
        "tiempo_estancia": 6,
        "catalogo": "",
        "estado_id": 1,
        "banco": "Banpro",
        "no_cuenta": "991-234-882",
    },
    {
        "nombre_marca": "Komorebi Crafts",
        "codigo": "KMB",
        "categoria": "Papelería & Cerámica",
        "razon_social": "Komorebi Crafts EIRL",
        "ciudad_pais": "Managua, Nicaragua",
        "redes_sociales": "@komorebi.store",
        "nombre_representante": "Kenji Tanaka",
        "cargo": "Administrador",
        "contacto_nombre": "Kenji Tanaka",
        "telefono": "+505 1234 5678",
        "email": "kenji@komorebi.store",
        "fecha_ingreso": datetime(2023, 11, 1),
        "tiempo_estancia": 12,
        "catalogo": "",
        "estado_id": 2,
        "banco": "BAC Credomatic",
        "no_cuenta": "123-456-789",
    }
]

def seed_marcas():
    db = SessionLocal()
    try:
        from app.models.marcas import Marca, Cuenta
        existing = db.query(Marca).count()
        if existing <= 1:
            db.query(Cuenta).delete()
            db.query(Marca).delete()
            db.commit()
            for b in INITIAL_BRANDS:
                MarcasService.create(db, MarcaCreate(**b))
            print("Marcas sembradas con éxito en MySQL!")
        else:
            print(f"Ya existen {existing} marcas en la base de datos.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_marcas()
