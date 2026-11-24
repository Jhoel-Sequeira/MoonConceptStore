from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from decimal import Decimal

from app.schemas.clientes import AbonoClienteCreate, ClienteCreate, ClienteUpdate


class ClientesService:
    @staticmethod
    def get_all(db: Session, buscar: str | None = None, limite: int = 100) -> list[dict]:
        # ponytail: derive balances from movements; for larger client lists, replace correlated sums with grouped aggregates.
        params: dict = {"limite": limite}
        where = "WHERE lower(trim(c.nombre_cliente)) <> 'consumidor final'"
        if buscar and buscar.strip():
            where += " AND (c.nombre_cliente ILIKE :buscar OR COALESCE(c.telefono, '') ILIKE :buscar OR COALESCE(c.correo, '') ILIKE :buscar)"
            params["buscar"] = f"%{buscar.strip()}%"
        rows = db.execute(text(f"""
            SELECT c.id, c.nombre_cliente, c.telefono, c.correo, c.fecha_nacimiento,
                   COUNT(CASE WHEN e.modulo = 'ventas' AND e.nombre = 'Facturada' THEN v.id END) AS cantidad_compras,
                   COALESCE(SUM(CASE WHEN e.modulo = 'ventas' AND e.nombre = 'Facturada' THEN v.total - COALESCE((
                     SELECT sum(r.monto_reembolso) FROM devoluciones_venta r WHERE r.venta_id=v.id
                   ),0) ELSE 0 END), 0) AS total_compras,
                   COALESCE((SELECT sum(GREATEST(cc.monto_original - COALESCE((
                     SELECT sum(a.monto) FROM abonos_cuenta_cliente a WHERE a.cuenta_id=cc.id
                   ),0) - COALESCE((SELECT sum(r.monto_reembolso) FROM devoluciones_venta r WHERE r.venta_id=cc.venta_id),0),0))
                     FROM cuentas_cobrar_clientes cc WHERE cc.cliente_id=c.id),0) AS saldo_pendiente
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
        return {**dict(row), "cantidad_compras": 0, "total_compras": 0, "saldo_pendiente": 0}

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
                   COALESCE(SUM(CASE WHEN e.modulo = 'ventas' AND e.nombre = 'Facturada' THEN v.total - COALESCE((
                     SELECT sum(r.monto_reembolso) FROM devoluciones_venta r WHERE r.venta_id=v.id
                   ),0) ELSE 0 END), 0) AS total_compras,
                   COALESCE((SELECT sum(GREATEST(cc.monto_original - COALESCE((
                     SELECT sum(a.monto) FROM abonos_cuenta_cliente a WHERE a.cuenta_id=cc.id
                   ),0) - COALESCE((SELECT sum(r.monto_reembolso) FROM devoluciones_venta r WHERE r.venta_id=cc.venta_id),0),0))
                     FROM cuentas_cobrar_clientes cc WHERE cc.cliente_id=c.id),0) AS saldo_pendiente
            FROM clientes c
            LEFT JOIN ventas v ON v.cliente_id = c.id
            LEFT JOIN estados e ON e.id = v.estado_id
            WHERE c.id = :id
            GROUP BY c.id, c.nombre_cliente, c.telefono, c.correo, c.fecha_nacimiento
        """), {"id": cliente_id}).mappings().first()
        return dict(row) if row else None

    @staticmethod
    def get_credit_accounts(db: Session, cliente_id: int) -> list[dict] | None:
        if not db.execute(text("SELECT 1 FROM clientes WHERE id=:id"), {"id": cliente_id}).first():
            return None
        rows = db.execute(text("""
            SELECT cc.id AS cuenta_id, cc.venta_id, v.fecha_venta, cc.monto_original,
                   COALESCE((SELECT sum(a.monto) FROM abonos_cuenta_cliente a WHERE a.cuenta_id=cc.id),0) AS abonado,
                   COALESCE((SELECT sum(r.monto_reembolso) FROM devoluciones_venta r WHERE r.venta_id=cc.venta_id),0) AS devuelto,
                   GREATEST(cc.monto_original
                     - COALESCE((SELECT sum(a.monto) FROM abonos_cuenta_cliente a WHERE a.cuenta_id=cc.id),0)
                     - COALESCE((SELECT sum(r.monto_reembolso) FROM devoluciones_venta r WHERE r.venta_id=cc.venta_id),0),0) AS saldo_pendiente,
                   COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'fecha_pago',a.fecha_pago,'monto',a.monto,'metodo_pago',a.metodo_pago,'referencia',a.referencia
                   ) ORDER BY a.fecha_pago,a.id) FROM abonos_cuenta_cliente a WHERE a.cuenta_id=cc.id),'[]'::jsonb) AS abonos
            FROM cuentas_cobrar_clientes cc JOIN ventas v ON v.id=cc.venta_id
            WHERE cc.cliente_id=:id
              AND cc.monto_original
                - COALESCE((SELECT sum(a.monto) FROM abonos_cuenta_cliente a WHERE a.cuenta_id=cc.id),0)
                - COALESCE((SELECT sum(r.monto_reembolso) FROM devoluciones_venta r WHERE r.venta_id=cc.venta_id),0) > 0
            ORDER BY v.fecha_venta, cc.venta_id
        """), {"id": cliente_id}).mappings().all()
        return [dict(row) for row in rows]

    @staticmethod
    def register_payment(db: Session, cliente_id: int, data: AbonoClienteCreate, user_id: int) -> dict:
        try:
            account = db.execute(text("""
                SELECT id, venta_id, monto_original FROM cuentas_cobrar_clientes
                WHERE id=:account_id AND cliente_id=:cliente_id FOR UPDATE
            """), {"account_id": data.cuenta_id, "cliente_id": cliente_id}).mappings().first()
            if not account:
                raise HTTPException(status_code=404, detail="Cuenta por cobrar no encontrada.")

            paid = db.execute(text("""
                SELECT COALESCE(sum(monto),0) FROM abonos_cuenta_cliente WHERE cuenta_id=:account_id
            """), {"account_id": data.cuenta_id}).scalar_one()
            returned = db.execute(text("""
                SELECT COALESCE(sum(monto_reembolso),0) FROM devoluciones_venta WHERE venta_id=:sale_id
            """), {"sale_id": account["venta_id"]}).scalar_one()
            balance = Decimal(account["monto_original"]) - Decimal(paid) - Decimal(returned)
            if balance <= 0:
                raise HTTPException(status_code=409, detail="Esta cuenta ya no tiene saldo pendiente.")
            if data.monto > balance:
                raise HTTPException(status_code=422, detail=f"El abono supera el saldo pendiente de C$ {balance:.2f}.")

            payment_id = db.execute(text("""
                INSERT INTO abonos_cuenta_cliente (cuenta_id, monto, metodo_pago, referencia, registrado_por)
                VALUES (:account_id,:amount,:method,:reference,:user_id) RETURNING id
            """), {
                "account_id": data.cuenta_id,
                "amount": data.monto,
                "method": data.metodo_pago,
                "reference": data.referencia.strip() or None if data.referencia else None,
                "user_id": user_id,
            }).scalar_one()
            new_balance = balance - data.monto
            db.commit()
            return {"id": payment_id, "cuenta_id": data.cuenta_id, "abono": data.monto, "saldo_pendiente": new_balance}
        except Exception:
            db.rollback()
            raise
