import calendar
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from io import BytesIO
import unicodedata
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from openpyxl import load_workbook
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


def _brand_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().casefold())
    return " ".join("".join(char for char in normalized if not unicodedata.combining(char)).split())


class RentaService:
    @staticmethod
    def import_configurations(db: Session, content: bytes) -> dict:
        try:
            try:
                workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
            except Exception as exc:
                raise ValueError("No se pudo leer el archivo Excel.") from exc
            sheet = workbook.active
            header_row = next(sheet.iter_rows(values_only=True), None)
            if not header_row:
                raise ValueError("La plantilla está vacía.")
            headers = [str(value or "").strip().casefold() for value in header_row]
            required = {"nombre_marca", "monto_mensual", "dia_vencimiento", "fecha_inicio", "fecha_fin", "activa"}
            if not required.issubset(headers):
                raise ValueError("La plantilla debe incluir nombre_marca, monto_mensual, dia_vencimiento, fecha_inicio, fecha_fin y activa.")
            columns = {name: headers.index(name) for name in required}
            rows = []
            for row_number, values in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                values = (*values, *(None for _ in range(max(0, len(headers) - len(values)))))
                if not any(value is not None for value in values):
                    continue
                try:
                    brand_name = str(values[columns["nombre_marca"]] or "").strip()
                    amount = Decimal(str(values[columns["monto_mensual"]]))
                    due_value = Decimal(str(values[columns["dia_vencimiento"]]))
                    if not due_value.is_finite() or due_value != due_value.to_integral_value():
                        raise ValueError("el día de vencimiento debe ser un entero")
                    due_day = int(due_value)
                    start = values[columns["fecha_inicio"]]
                    end = values[columns["fecha_fin"]]
                    active = values[columns["activa"]]
                    start = start.date() if isinstance(start, datetime) else start
                    end = end.date() if isinstance(end, datetime) else end
                    if isinstance(start, str):
                        start = date.fromisoformat(start)
                    if isinstance(end, str) and end.strip():
                        end = date.fromisoformat(end)
                    elif not end:
                        end = None
                    if isinstance(active, str):
                        active_value = active.strip().casefold()
                        if active_value not in {"true", "1", "si", "sí", "activo", "false", "0", "no", "inactivo"}:
                            raise ValueError("activa debe ser verdadero o falso")
                        active = active_value in {"true", "1", "si", "sí", "activo"}
                    elif active in (0, 1):
                        active = bool(active)
                    if not brand_name or not amount.is_finite() or amount <= 0 or due_day < 1 or due_day > 31 or not isinstance(start, date):
                        raise ValueError("nombre, monto, día de vencimiento o fecha de inicio inválidos")
                    if end and (not isinstance(end, date) or end < start):
                        raise ValueError("fecha de fin anterior al inicio o inválida")
                    if not isinstance(active, bool):
                        raise ValueError("activa debe ser verdadero o falso")
                    rows.append({"nombre": brand_name, "key": _brand_key(brand_name), "monto": amount,
                                 "dia": due_day, "inicio": start, "fin": end, "activa": active,
                                 "fila": row_number})
                except (ValueError, TypeError, ArithmeticError) as exc:
                    raise ValueError(f"Fila {row_number}: {exc}") from exc
            if not rows:
                raise ValueError("La plantilla no contiene configuraciones para importar.")
            keys = [row["key"] for row in rows]
            if len(keys) != len(set(keys)):
                raise ValueError("La plantilla repite una marca.")
            brands = db.query(Marca).all()
            brand_map = {}
            for brand in brands:
                key = _brand_key(brand.nombre_marca)
                if key in brand_map:
                    raise ValueError(f"Hay marcas con nombres duplicados que impiden identificar '{brand.nombre_marca}'.")
                brand_map[key] = brand
            unmatched = [row["nombre"] for row in rows if row["key"] not in brand_map]
            if unmatched:
                raise ValueError("No se encontraron estas marcas: " + ", ".join(unmatched))
            configs = {config.marca_id: config for config in db.query(RentaConfig).all()}
            created = updated = 0
            for row in rows:
                brand_id = brand_map[row["key"]].id
                config = configs.get(brand_id)
                if config is None:
                    config = RentaConfig(marca_id=brand_id)
                    db.add(config)
                    created += 1
                else:
                    updated += 1
                config.monto_mensual = row["monto"]
                config.dia_vencimiento = row["dia"]
                config.fecha_inicio = row["inicio"]
                config.fecha_fin = row["fin"]
                config.activa = row["activa"]
            db.commit()
            return {"creadas": created, "actualizadas": updated, "total": len(rows)}
        except Exception:
            db.rollback()
            raise
        finally:
            if "workbook" in locals():
                workbook.close()

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
