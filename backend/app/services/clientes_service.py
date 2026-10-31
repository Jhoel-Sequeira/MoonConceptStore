from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.clientes import ClienteCreate, ClienteUpdate


class ClientesService:
    @staticmethod
    def get_all(db: Session, buscar: str | None = None, limite: int = 100) -> list[dict]:
        params: dict = {"limite": limite}
        where = "WHERE lower(trim(c.nombre_cliente)) <> 'consumidor final'"
        if buscar and buscar.strip():
            where += " AND (c.nombre_cliente ILIKE :buscar OR COALESCE(c.telefono, '') ILIKE :buscar OR COALESCE(c.correo, '') ILIKE :buscar)"
            params["buscar"] = f"%{buscar.strip()}%"
        rows = db.execute(text(f"""
            SELECT c.id, c.nombre_cliente, c.telefono, c.correo, c.fecha_nacimiento,
                   COUNT(CASE WHEN e.modulo = 'ventas' AND e.nombre = 'Facturada' THEN v.id END) AS cantidad_compras,
                   COALESCE(SUM(CASE WHEN e.modulo = 'ventas' AND e.nombre = 'Facturada' THEN v.total ELSE 0 END), 0) AS total_compras
            FROM clientes c
            LEFT JOIN ventas v ON v.cliente_id = c.id
            LEFT JOIN estados e ON e.id = v.estado_id
            {where}
            GROUP BY c.id, c.nombre_cliente, c.telefono, c.correo, c.fecha_nacimiento
            ORDER BY lower(c.nombre_cliente), c.id
            LIMIT :limite
        """), params).mappings().all()
        return [dict(row) for row in rows]

    @staticmethod
    def create(db: Session, data: ClienteCreate) -> dict:
        name = data.nombre_cliente.strip()
        if not name:
            raise HTTPException(status_code=422, detail="El nombre del cliente es obligatorio.")
        row = db.execute(text("""
            INSERT INTO clientes (nombre_cliente, telefono, correo, fecha_nacimiento)
            VALUES (:nombre, :telefono, :correo, :fecha_nacimiento)
            RETURNING id, nombre_cliente, telefono, correo, fecha_nacimiento
        """), {
            "nombre": name,
            "telefono": data.telefono.strip() or None if data.telefono else None,
            "correo": data.correo.strip() or None if data.correo else None,
            "fecha_nacimiento": data.fecha_nacimiento,
        }).mappings().one()
        db.commit()
        return {**dict(row), "cantidad_compras": 0, "total_compras": 0}

    @staticmethod
    def update(db: Session, cliente_id: int, data: ClienteUpdate) -> dict:
        name = data.nombre_cliente.strip()
        if not name:
            raise HTTPException(status_code=422, detail="El nombre del cliente es obligatorio.")
        row = db.execute(text("""
            UPDATE clientes
            SET nombre_cliente = :nombre, telefono = :telefono, correo = :correo, fecha_nacimiento = :fecha_nacimiento
            WHERE id = :id
            RETURNING id, nombre_cliente, telefono, correo, fecha_nacimiento
        """), {
            "id": cliente_id,
            "nombre": name,
            "telefono": data.telefono.strip() or None if data.telefono else None,
            "correo": data.correo.strip() or None if data.correo else None,
            "fecha_nacimiento": data.fecha_nacimiento,
        }).mappings().first()
        if not row:
            db.rollback()
            raise HTTPException(status_code=404, detail="Cliente no encontrado.")
        db.commit()
        return ClientesService.get_by_id(db, cliente_id)

    @staticmethod
    def get_by_id(db: Session, cliente_id: int) -> dict | None:
        row = db.execute(text("""
            SELECT c.id, c.nombre_cliente, c.telefono, c.correo, c.fecha_nacimiento,
                   COUNT(CASE WHEN e.modulo = 'ventas' AND e.nombre = 'Facturada' THEN v.id END) AS cantidad_compras,
                   COALESCE(SUM(CASE WHEN e.modulo = 'ventas' AND e.nombre = 'Facturada' THEN v.total ELSE 0 END), 0) AS total_compras
            FROM clientes c
            LEFT JOIN ventas v ON v.cliente_id = c.id
            LEFT JOIN estados e ON e.id = v.estado_id
            WHERE c.id = :id
            GROUP BY c.id, c.nombre_cliente, c.telefono, c.correo, c.fecha_nacimiento
        """), {"id": cliente_id}).mappings().first()
        return dict(row) if row else None
