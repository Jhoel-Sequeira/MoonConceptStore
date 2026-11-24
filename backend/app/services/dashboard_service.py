from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.cierre_caja_service import business_day, utc_naive_bounds
from app.services.inventario_service import InventarioService


class DashboardService:
    @staticmethod
    def get_summary(db: Session) -> dict:
        today_date = business_day()
        today_start, tomorrow_start = utc_naive_bounds(today_date, today_date + timedelta(days=1))
        week_start = today_date - timedelta(days=6)
        week_start_utc, _ = utc_naive_bounds(week_start, week_start + timedelta(days=1))
        billed_status = """
            SELECT id FROM estados
            WHERE modulo = 'ventas' AND nombre = 'Facturada'
        """

        today = db.execute(
            text(f"""
                SELECT
                    COALESCE(SUM(v.total), 0) - COALESCE((
                        SELECT SUM(r.monto_reembolso) FROM devoluciones_venta r
                        JOIN ventas rv ON rv.id=r.venta_id JOIN estados re ON re.id=rv.estado_id
                          AND re.modulo='ventas' AND re.nombre='Facturada'
                        WHERE r.fecha_devolucion >= :today_start AND r.fecha_devolucion < :tomorrow_start
                    ), 0) AS sales_total,
                    COUNT(DISTINCT v.id) AS sales_count,
                    COUNT(DISTINCT v.cliente_id) AS customers_count,
                    COALESCE((
                        SELECT SUM(vd.cantidad)
                        FROM venta_detalles vd
                        JOIN ventas vs ON vs.id = vd.venta_id
                        WHERE vs.fecha_venta >= :today_start
                          AND vs.fecha_venta < :tomorrow_start
                          AND vs.estado_id IN ({billed_status})
                    ), 0) - COALESCE((
                        SELECT SUM(d.cantidad)
                        FROM devoluciones_venta r
                        JOIN devoluciones_venta_detalles d ON d.devolucion_id=r.id
                        JOIN ventas rv ON rv.id=r.venta_id JOIN estados re ON re.id=rv.estado_id
                          AND re.modulo='ventas' AND re.nombre='Facturada'
                        WHERE r.fecha_devolucion >= :today_start AND r.fecha_devolucion < :tomorrow_start
                    ), 0) AS units_sold
                FROM ventas v
                WHERE v.fecha_venta >= :today_start
                  AND v.fecha_venta < :tomorrow_start
                  AND v.estado_id IN ({billed_status})
            """), {"today_start": today_start, "tomorrow_start": tomorrow_start}).mappings().one()

        weekly_sales = db.execute(
            text(f"""
                WITH days AS (
                    SELECT generate_series(
                        :week_start,
                        :today,
                        INTERVAL '1 day'
                    )::date AS day
                ), movements AS (
                    SELECT (v.fecha_venta AT TIME ZONE 'UTC' AT TIME ZONE 'America/Managua')::date AS day, v.total AS amount
                    FROM ventas v JOIN estados e ON e.id=v.estado_id
                    WHERE e.modulo='ventas' AND e.nombre='Facturada'
                      AND (v.fecha_venta AT TIME ZONE 'UTC' AT TIME ZONE 'America/Managua')::date BETWEEN :week_start AND :today
                    UNION ALL
                    SELECT (r.fecha_devolucion AT TIME ZONE 'UTC' AT TIME ZONE 'America/Managua')::date AS day, -r.monto_reembolso AS amount
                    FROM devoluciones_venta r
                    JOIN ventas rv ON rv.id=r.venta_id JOIN estados re ON re.id=rv.estado_id AND re.modulo='ventas' AND re.nombre='Facturada'
                    WHERE (r.fecha_devolucion AT TIME ZONE 'UTC' AT TIME ZONE 'America/Managua')::date BETWEEN :week_start AND :today
                )
                SELECT days.day, COALESCE(SUM(movements.amount), 0) AS total
                FROM days
                LEFT JOIN movements ON movements.day = days.day
                GROUP BY days.day
                ORDER BY days.day
            """), {"week_start": week_start, "today": today_date}).mappings().all()

        best_sellers = db.execute(
            text(f"""
                WITH unit_movements AS (
                    SELECT p.id, p.nombre, vd.cantidad AS units
                    FROM ventas v JOIN venta_detalles vd ON vd.venta_id=v.id
                    JOIN productos p ON p.id=vd.producto_id
                    WHERE v.fecha_venta >= :week_start_utc AND v.fecha_venta < :tomorrow_start
                      AND v.estado_id IN ({billed_status})
                    UNION ALL
                    SELECT p.id, p.nombre, -d.cantidad AS units
                    FROM devoluciones_venta r JOIN devoluciones_venta_detalles d ON d.devolucion_id=r.id
                    JOIN productos p ON p.id=d.producto_id
                    JOIN ventas rv ON rv.id=r.venta_id JOIN estados re ON re.id=rv.estado_id AND re.modulo='ventas' AND re.nombre='Facturada'
                    WHERE r.fecha_devolucion >= :week_start_utc AND r.fecha_devolucion < :tomorrow_start
                )
                SELECT id, nombre, SUM(units) AS units FROM unit_movements GROUP BY id, nombre
                ORDER BY units DESC, nombre
                LIMIT 5
            """), {"week_start_utc": week_start_utc, "tomorrow_start": tomorrow_start}).mappings().all()

        inventory = InventarioService.get_stats(db)
        return {
            "sales_today": float(today["sales_total"] or 0),
            "sales_count_today": int(today["sales_count"] or 0),
            "units_sold_today": int(today["units_sold"] or 0),
            "customers_today": int(today["customers_count"] or 0),
            "low_stock_products": int(inventory.skus_bajo_stock),
            "sales_last_7_days": [
                {"date": row["day"].isoformat(), "total": float(row["total"] or 0)}
                for row in weekly_sales
            ],
            "best_sellers": [
                {"id": row["id"], "name": row["nombre"], "units": int(row["units"] or 0)}
                for row in best_sellers
            ],
        }
