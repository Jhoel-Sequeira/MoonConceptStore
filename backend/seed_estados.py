from app.core.database import SessionLocal
from sqlalchemy import text

def seed_estados():
    db = SessionLocal()
    try:
        db.execute(text("""
            INSERT INTO estados (id, modulo, nombre, descripcion) 
            VALUES 
            (1, 'marcas', 'Activa', 'Marca activa y operando'),
            (2, 'marcas', 'Inactiva', 'Marca en pausa o dada de baja')
            ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), descripcion=VALUES(descripcion)
        """))
        db.commit()
        rows = db.execute(text("SELECT id, modulo, nombre, descripcion FROM estados")).fetchall()
        print("Estados actuales:", rows)
    finally:
        db.close()

if __name__ == "__main__":
    seed_estados()
