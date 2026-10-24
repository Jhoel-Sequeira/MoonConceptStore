import calendar
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import Date, cast, func, or_, text
from sqlalchemy.orm import Session, joinedload

from app.models.marcas import Marca
from app.models.renta import Renta, RentaConfig, RentaPago


MANAGUA = ZoneInfo("America/Managua")
LOCK_NAMESPACE = 20261029


def _period(value: str) -> tuple[date, date]:
    try:
        first = datetime.strptime(value, "%Y-%m").date().replace(day=1)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="El período debe tener formato YYYY-MM.") from exc
    return first, first.replace(day=calendar.monthrange(first.year, first.month)[1])


def current_period() -> str:
    return datetime.now(MANAGUA).strftime("%Y-%m")


def _due_date(first: date, last: date, due_day: int) -> date:
    return first.replace(day=min(due_day, last.day))


def _contract_due_date(first: date, last: date, due_day: int, start_date: date) -> date:
    due = _due_date(first, last, due_day)
    if start_date.year == first.year and start_date.month == first.month and start_date > due:
        return start_date
    return due


def _paid(renta: Renta) -> Decimal:
    return sum((Decimal(str(payment.monto_pagado or 0)) for payment in renta.pagos), Decimal("0.00"))


class RentaService:
    @staticmethod
    def list_for_period(db: Session, period: str) -> dict:
        first, last = _period(period)
        start = datetime.combine(first, time.min)
        end = datetime.combine(last + timedelta(days=1), time.min)
        rows = db.query(Renta).options(joinedload(Renta.marca), joinedload(Renta.pagos)).filter(
            or_(Renta.periodo == first, (Renta.periodo.is_(None) & (Renta.fecha_pago >= start) & (Renta.fecha_pago < end)))
        ).order_by(Renta.fecha_vencimiento, Renta.id).all()
        today = datetime.now(MANAGUA).date()
        obligations = []
        for row in rows:
            paid = _paid(row)
            amount = Decimal(str(row.monto or 0))
            balance = amount - paid
            due = row.fecha_vencimiento or (row.fecha_pago.date() if row.fecha_pago else None)
            status = "Pagada" if balance <= 0 else "Vencida" if due and due < today else "Parcial" if paid > 0 else "Pendiente"
            obligations.append({
                "id": row.id, "marca_id": row.marca_id,
                "marca": row.marca.nombre_marca if row.marca else "Marca eliminada",
                "periodo": (row.periodo or (due.replace(day=1) if due else first)).isoformat(),
                "fecha_vencimiento": due.isoformat() if due else None,
                "monto": amount, "pagado": paid, "saldo": max(balance, Decimal("0.00")), "estado": status,
                "por_vencer": bool(due and Decimal("0.00") < balance and today <= due <= today + timedelta(days=7)),
                "pagos": [{
                    "pago_id": payment.pago_id, "monto_pagado": payment.monto_pagado,
                    "fecha_pago": payment.fecha_pago.date().isoformat() if payment.fecha_pago else None,
                    "referencia_pago": payment.referencia_pago, "comentario": payment.comentario,
                } for payment in sorted(row.pagos, key=lambda value: value.fecha_pago or datetime.min)],
            })
        configs = db.query(RentaConfig).options(joinedload(RentaConfig.marca)).order_by(RentaConfig.marca_id).all()
        payments = db.query(
            RentaPago.renta_id.label("renta_id"),
            func.coalesce(func.sum(RentaPago.monto_pagado), 0).label("paid"),
        ).group_by(RentaPago.renta_id).subquery()
        paid_total = func.coalesce(payments.c.paid, 0)
        due_date = func.coalesce(Renta.fecha_vencimiento, cast(Renta.fecha_pago, Date))
        overdue_count, overdue_balance = db.query(
            func.count(Renta.id), func.coalesce(func.sum(Renta.monto - paid_total), 0),
        ).outerjoin(payments, payments.c.renta_id == Renta.id).filter(
            due_date < today, Renta.monto > paid_total,
        ).one()
        soon_count = db.query(func.count(Renta.id)).outerjoin(
            payments, payments.c.renta_id == Renta.id,
        ).filter(
            due_date >= today, due_date <= today + timedelta(days=7),
            Renta.monto > paid_total,
        ).scalar()
        return {
            "periodo": period,
            "rentas": obligations,
            "configuraciones": [{
                "id": config.id, "marca_id": config.marca_id,
                "marca": config.marca.nombre_marca if config.marca else "Marca eliminada",
                "monto_mensual": config.monto_mensual, "dia_vencimiento": config.dia_vencimiento,
                "fecha_inicio": config.fecha_inicio.isoformat(),
                "fecha_fin": config.fecha_fin.isoformat() if config.fecha_fin else None,
                "activa": config.activa,
            } for config in configs],
            "resumen": {
                "monto_total": sum((Decimal(str(row["monto"])) for row in obligations), Decimal("0.00")),
                "total_pagado": sum((Decimal(str(row["pagado"])) for row in obligations), Decimal("0.00")),
                "saldo_pendiente": sum((Decimal(str(row["saldo"])) for row in obligations), Decimal("0.00")),
                "vencidas": sum(1 for row in obligations if row["estado"] == "Vencida"),
                "saldo_vencido": overdue_balance,
                "vencidas_total": int(overdue_count or 0),
                "por_vencer": int(soon_count or 0),
            },
        }

    @staticmethod
    def save_config(db: Session, values: dict) -> dict:
        start = values["fecha_inicio"]
        end = values.get("fecha_fin")
        if end and end < start:
            raise HTTPException(status_code=422, detail="La fecha de fin debe ser igual o posterior al inicio.")
        if not db.query(Marca.id).filter(Marca.id == values["marca_id"]).first():
            raise HTTPException(status_code=404, detail="Marca no encontrada.")
        if not values["activa"] and end is None:
            end = datetime.now(MANAGUA).date()
        try:
            config_id = db.execute(text("""
                INSERT INTO renta_config (marca_id, monto_mensual, dia_vencimiento, fecha_inicio, fecha_fin, activa)
                VALUES (:marca_id, :monto, :dia, :inicio, :fin, :activa)
                ON CONFLICT (marca_id) DO UPDATE SET
                    monto_mensual = EXCLUDED.monto_mensual,
                    dia_vencimiento = EXCLUDED.dia_vencimiento,
                    fecha_inicio = EXCLUDED.fecha_inicio,
                    fecha_fin = EXCLUDED.fecha_fin,
                    activa = EXCLUDED.activa
                RETURNING id
            """), {
                "marca_id": values["marca_id"], "monto": values["monto_mensual"],
                "dia": values["dia_vencimiento"], "inicio": start, "fin": end,
                "activa": values["activa"],
            }).scalar_one()
            db.commit()
            return {"id": config_id, "marca_id": values["marca_id"]}
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def generate(db: Session, period: str) -> dict:
        first, last = _period(period)
        current_first, _ = _period(current_period())
        if first > current_first:
            raise HTTPException(status_code=422, detail="No se pueden generar rentas de meses futuros.")
        configs = db.query(RentaConfig).options(joinedload(RentaConfig.marca)).filter(
            RentaConfig.fecha_inicio <= last,
            or_(RentaConfig.fecha_fin.is_(None), RentaConfig.fecha_fin >= first),
        ).order_by(RentaConfig.marca_id).all()
        created = 0
        try:
            db.execute(text("SELECT pg_advisory_xact_lock(:namespace, :period_key)"), {
                "namespace": LOCK_NAMESPACE, "period_key": first.year * 100 + first.month,
            })
            for config in configs:
                if not config.activa and config.fecha_fin is None:
                    continue
                due = _contract_due_date(first, last, config.dia_vencimiento, config.fecha_inicio)
                result = db.execute(text("""
                    INSERT INTO renta (marca_id, periodo, fecha_vencimiento, fecha_pago, monto, config_id)
                    VALUES (:marca_id, :periodo, :due, :legacy_due, :monto, :config_id)
                    ON CONFLICT (marca_id, periodo) DO NOTHING RETURNING id
                """), {
                    "marca_id": config.marca_id, "periodo": first, "due": due,
                    "legacy_due": datetime.combine(due, time(12)), "monto": config.monto_mensual,
                    "config_id": config.id,
                }).scalar()
                created += int(result is not None)
            db.commit()
        except Exception:
            db.rollback()
            raise
        return {"creadas": created, "periodo": period}

    @staticmethod
    def add_payment(db: Session, rent_id: int, values: dict) -> dict:
        if values["fecha_pago"] > datetime.now(MANAGUA).date():
            raise HTTPException(status_code=422, detail="La fecha de pago no puede ser futura.")
        reference = values["referencia_pago"].strip()
        if not reference:
            raise HTTPException(status_code=422, detail="La referencia del pago es obligatoria.")
        try:
            db.execute(text("SELECT pg_advisory_xact_lock(:namespace, :rent_id)"), {
                "namespace": LOCK_NAMESPACE + 1, "rent_id": rent_id,
            })
            row = db.query(Renta).filter(Renta.id == rent_id).with_for_update().first()
            if not row:
                raise HTTPException(status_code=404, detail="Renta no encontrada.")
            paid = db.query(func.coalesce(func.sum(RentaPago.monto_pagado), 0)).filter(RentaPago.renta_id == rent_id).scalar()
            amount = Decimal(str(row.monto or 0))
            payment_amount = values["monto_pagado"]
            if Decimal(str(paid)) + payment_amount > amount:
                raise HTTPException(status_code=400, detail="El pago supera el saldo pendiente.")
            payment = RentaPago(
                renta_id=rent_id, monto_pagado=payment_amount,
                fecha_pago=datetime.combine(values["fecha_pago"], time(12)),
                referencia_pago=reference, comentario=(values.get("comentario") or "").strip() or None,
            )
            db.add(payment)
            db.commit()
            return {"status": "ok", "pago_id": payment.pago_id}
        except HTTPException:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            raise
