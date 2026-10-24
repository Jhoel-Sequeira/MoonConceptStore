from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session


MANAGUA = ZoneInfo("America/Managua")
METHODS = ("Efectivo", "Tarjeta", "Transferencia")
LOCK_NAMESPACE = 19841024


def business_day() -> date:
    return datetime.now(MANAGUA).date()


def utc_naive_bounds(start: date, end_exclusive: date) -> tuple[datetime, datetime]:
    start_local = datetime.combine(start, time.min, MANAGUA)
    end_local = datetime.combine(end_exclusive, time.min, MANAGUA)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def lock_day(db: Session, day: date) -> None:
    db.execute(text("SELECT pg_advisory_xact_lock(:namespace, :day_key)"), {
        "namespace": LOCK_NAMESPACE, "day_key": day.toordinal()
    })


def _payments(db: Session, day: date) -> dict[str, Decimal]:
    start, end = utc_naive_bounds(day, day + timedelta(days=1))
    rows = db.execute(text("""
        SELECT lower(trim(p.metodo_pago)) AS metodo, COALESCE(sum(p.monto), 0) AS monto
        FROM pagos_venta p
        JOIN ventas v ON v.id = p.venta_id
        JOIN estados e ON e.id = v.estado_id AND e.modulo = 'ventas' AND e.nombre = 'Facturada'
        WHERE v.fecha_venta >= :start AND v.fecha_venta < :end
        GROUP BY lower(trim(p.metodo_pago))
    """), {"start": start, "end": end}).mappings().all()
    return {str(row["metodo"]): Decimal(row["monto"] or 0) for row in rows}


class CierreCajaService:
    @staticmethod
    def current(db: Session) -> dict:
        day = business_day()
        cierre = db.execute(text("SELECT * FROM cierres_caja WHERE fecha = :day"), {"day": day}).mappings().first()
        payments = _payments(db, day)
        amounts = {method.lower(): payments.get(method.lower(), Decimal("0.00")) for method in METHODS}
        if cierre:
            expected = {
                "efectivo": Decimal(cierre["esperado_efectivo"]),
                "tarjeta": Decimal(cierre["esperado_tarjeta"]),
                "transferencia": Decimal(cierre["esperado_transferencia"]),
            }
            contado = {
                "efectivo": Decimal(cierre["contado_efectivo"]),
                "tarjeta": Decimal(cierre["contado_tarjeta"]),
                "transferencia": Decimal(cierre["contado_transferencia"]),
            }
            return {
                "fecha": day.isoformat(), "cerrado": True,
                "fondo_inicial": cierre["fondo_inicial"], "ventas": amounts,
                "esperado": expected, "contado": contado,
                "diferencias": {key: contado[key] - expected[key] for key in expected},
                "observaciones": cierre["observaciones"], "cerrado_en": cierre["cerrado_en"],
            }
        return {
            "fecha": day.isoformat(), "cerrado": False,
            "fondo_inicial": None, "ventas": amounts,
            "esperado": {"efectivo": None, "tarjeta": amounts["tarjeta"], "transferencia": amounts["transferencia"]},
            "contado": None, "diferencias": None,
        }

    @staticmethod
    def close(db: Session, user_id: int, values: dict) -> dict:
        day = business_day()
        try:
            lock_day(db, day)
            existing = db.execute(text("SELECT id FROM cierres_caja WHERE fecha = :day"), {"day": day}).scalar()
            if existing:
                raise HTTPException(status_code=409, detail="La caja de hoy ya fue cerrada.")
            payments = _payments(db, day)
            opening = Decimal(str(values["fondo_inicial"]))
            expected = {
                "efectivo": opening + payments.get("efectivo", Decimal("0.00")),
                "tarjeta": payments.get("tarjeta", Decimal("0.00")),
                "transferencia": payments.get("transferencia", Decimal("0.00")),
            }
            counted = {key: Decimal(str(values[f"contado_{key}"])) for key in expected}
            db.execute(text("""
                INSERT INTO cierres_caja
                (fecha, usuario_id, fondo_inicial, esperado_efectivo, esperado_tarjeta,
                 esperado_transferencia, contado_efectivo, contado_tarjeta, contado_transferencia, observaciones)
                VALUES (:fecha, :user_id, :fondo, :ee, :et, :etr, :ce, :ct, :ctr, :observaciones)
            """), {
                "fecha": day, "user_id": user_id, "fondo": opening,
                "ee": expected["efectivo"], "et": expected["tarjeta"], "etr": expected["transferencia"],
                "ce": counted["efectivo"], "ct": counted["tarjeta"], "ctr": counted["transferencia"],
                "observaciones": values.get("observaciones"),
            })
            db.commit()
            return CierreCajaService.current(db)
        except HTTPException:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            raise
