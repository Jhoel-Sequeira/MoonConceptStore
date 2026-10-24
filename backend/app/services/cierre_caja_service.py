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
            reabierta = cierre.get("reabierta_en") and cierre["reabierta_en"] > cierre["cerrado_en"]
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
                "fecha": day.isoformat(), "cerrado": not reabierta,
                "fondo_inicial": cierre["fondo_inicial"], "ventas": amounts,
                "esperado": expected, "contado": contado,
                "diferencias": {key: contado[key] - expected[key] for key in expected},
                "observaciones": cierre["observaciones"], "cerrado_en": cierre["cerrado_en"],
                "reabierta_en": cierre.get("reabierta_en"),
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
            existing = db.execute(text("SELECT * FROM cierres_caja WHERE fecha = :day FOR UPDATE"), {"day": day}).mappings().first()
            if existing and (not existing["reabierta_en"] or existing["reabierta_en"] <= existing["cerrado_en"]):
                raise HTTPException(status_code=409, detail="La caja de hoy ya fue cerrada.")
            payments = _payments(db, day)
            opening = Decimal(str(values["fondo_inicial"]))
            expected = {
                "efectivo": opening + payments.get("efectivo", Decimal("0.00")),
                "tarjeta": payments.get("tarjeta", Decimal("0.00")),
                "transferencia": payments.get("transferencia", Decimal("0.00")),
            }
            counted = {key: Decimal(str(values[f"contado_{key}"])) for key in expected}
            params = {
                "fecha": day, "user_id": user_id, "fondo": opening,
                "ee": expected["efectivo"], "et": expected["tarjeta"], "etr": expected["transferencia"],
                "ce": counted["efectivo"], "ct": counted["tarjeta"], "ctr": counted["transferencia"],
                "observaciones": values.get("observaciones"),
            }
            if existing:
                db.execute(text("""
                    UPDATE cierres_caja SET usuario_id=:user_id, fondo_inicial=:fondo,
                    esperado_efectivo=:ee, esperado_tarjeta=:et, esperado_transferencia=:etr,
                    contado_efectivo=:ce, contado_tarjeta=:ct, contado_transferencia=:ctr,
                    observaciones=:observaciones, cerrado_en=CURRENT_TIMESTAMP
                    WHERE id=:id
                """), {**params, "id": existing["id"]})
            else:
                db.execute(text("""
                INSERT INTO cierres_caja
                (fecha, usuario_id, fondo_inicial, esperado_efectivo, esperado_tarjeta,
                 esperado_transferencia, contado_efectivo, contado_tarjeta, contado_transferencia, observaciones)
                VALUES (:fecha, :user_id, :fondo, :ee, :et, :etr, :ce, :ct, :ctr, :observaciones)
                """), params)
            db.commit()
            return CierreCajaService.current(db)
        except HTTPException:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def reopen(db: Session, user_id: int) -> dict:
        day = business_day()
        try:
            lock_day(db, day)
            cierre = db.execute(text("SELECT * FROM cierres_caja WHERE fecha = :day FOR UPDATE"), {"day": day}).mappings().first()
            if not cierre or (cierre["reabierta_en"] and cierre["reabierta_en"] > cierre["cerrado_en"]):
                raise HTTPException(status_code=409, detail="No hay un cierre vigente de hoy para reabrir.")
            db.execute(text("""
                UPDATE cierres_caja SET reabierta_en=CURRENT_TIMESTAMP, reabierta_por=:user_id
                WHERE id=:id
            """), {"user_id": user_id, "id": cierre["id"]})
            db.commit()
            return CierreCajaService.current(db)
        except Exception:
            db.rollback()
            raise
