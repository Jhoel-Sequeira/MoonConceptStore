from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.inventario_service import InventarioService


class DashboardService:
    @staticmethod
    def get_summary(db: Session) -> dict:
        billed_status = """
            SELECT id FROM estados
            WHERE modulo = 'ventas' AND nombre = 'Facturada'
        """

        today = db.execute(
            text(f"""
                SELECT
                    COALESCE(SUM(v.total), 0) AS sales_total,
                    COUNT(DISTINCT v.id) AS sales_count,
                    COUNT(DISTINCT v.cliente_id) AS customers_count,
                    COALESCE((
                        SELECT SUM(vd.cantidad)
                        FROM venta_detalles vd
                        JOIN ventas vs ON vs.id = vd.venta_id
                        WHERE vs.fecha_venta >= CURRENT_DATE
                          AND vs.fecha_venta < CURRENT_DATE + INTERVAL '1 day'
                          AND vs.estado_id IN ({billed_status})
                    ), 0) AS units_sold
                FROM ventas v
                WHERE v.fecha_venta >= CURRENT_DATE
                  AND v.fecha_venta < CURRENT_DATE + INTERVAL '1 day'
                  AND v.estado_id IN ({billed_status})
            """)
        ).mappings().one()

        weekly_sales = db.execute(
            text(f"""
                WITH days AS (
                    SELECT generate_series(
                        CURRENT_DATE - INTERVAL '6 days',
                        CURRENT_DATE,
                        INTERVAL '1 day'
                    )::date AS day
                )
                SELECT days.day, COALESCE(SUM(v.total), 0) AS total
                FROM days
                LEFT JOIN ventas v
                  ON v.fecha_venta >= days.day
                 AND v.fecha_venta < days.day + INTERVAL '1 day'
                 AND v.estado_id IN ({billed_status})
                GROUP BY days.day
                ORDER BY days.day
            """)
        ).mappings().all()

        best_sellers = db.execute(
            text(f"""
                SELECT p.id, p.nombre, SUM(vd.cantidad) AS units
                FROM ventas v
                JOIN venta_detalles vd ON vd.venta_id = v.id
                JOIN productos p ON p.id = vd.producto_id
                WHERE v.fecha_venta >= CURRENT_DATE - INTERVAL '6 days'
                  AND v.fecha_venta < CURRENT_DATE + INTERVAL '1 day'
                  AND v.estado_id IN ({billed_status})
                GROUP BY p.id, p.nombre
                ORDER BY units DESC, p.nombre
                LIMIT 5
            """)
        ).mappings().all()

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
