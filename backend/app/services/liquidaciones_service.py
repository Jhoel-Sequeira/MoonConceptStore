import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from io import BytesIO
import re
import unicodedata
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as OpenpyxlImage
from PIL import Image as PILImage
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.storage import download_image
from app.services.cierre_caja_service import MANAGUA, lock_day, utc_naive_bounds


CENT = Decimal("0.01")


def _period(value: str) -> tuple[date, date]:
    try:
        first = datetime.strptime(value, "%Y-%m").date().replace(day=1)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="El período debe tener formato YYYY-MM.") from exc
    last = first.replace(day=calendar.monthrange(first.year, first.month)[1])
    return first, last


def _decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _allocate(total: Decimal, weights: list[Decimal]) -> list[Decimal]:
    total = total.quantize(CENT, rounding=ROUND_HALF_UP)
    weight_sum = sum(weights, Decimal("0"))
    if not weights or weight_sum <= 0:
        return [Decimal("0.00") for _ in weights]
    exact = [total * weight / weight_sum for weight in weights]
    amounts = [value.quantize(CENT, rounding=ROUND_DOWN) for value in exact]
    cents_left = int(((total - sum(amounts, Decimal("0"))) / CENT).to_integral_value())
    order = sorted(range(len(weights)), key=lambda index: (exact[index] - amounts[index], -index), reverse=True)
    for index in order[:cents_left]:
        amounts[index] += CENT
    return amounts


class LiquidacionesService:
    @staticmethod
    def report(db: Session, period: str | None, _compare: bool = True, *, desde: date | None = None,
               hasta: date | None = None, brand_ids: list[int] | None = None) -> dict:
        if desde is not None or hasta is not None:
            if period or desde is None or hasta is None or desde > hasta:
                raise HTTPException(status_code=422, detail="Indica un rango de fechas válido.")
            first, last = desde, hasta
        elif period:
            first, last = _period(period)
        else:
            raise HTTPException(status_code=422, detail="Indica un mes o un rango de fechas.")
        start, end = utc_naive_bounds(first, last + timedelta(days=1))
        brand_ids = sorted(set(brand_ids or []))
        product_rows = db.execute(text("""
            SELECT v.id AS venta_id, v.fecha_venta, v.total, v.comision_pos,
                   vd.producto_id, vd.cantidad, vd.subtotal, p.nombre, p.sku,
                   p.marca_id, m.nombre_marca, mp.metodo_pago
            FROM ventas v
            JOIN estados e ON e.id = v.estado_id AND e.modulo = 'ventas' AND e.nombre = 'Facturada'
            JOIN venta_detalles vd ON vd.venta_id = v.id
            JOIN productos p ON p.id = vd.producto_id
            JOIN marcas m ON m.id = p.marca_id
            JOIN pagos_venta pv ON pv.venta_id = v.id
            JOIN metodo_pago mp ON lower(mp.metodo_pago) = lower(pv.metodo_pago)
            WHERE v.fecha_venta >= :start AND v.fecha_venta < :end
            ORDER BY v.id, p.marca_id, vd.producto_id
        """), {"start": start, "end": end}).mappings().all()
        payment_rows = db.execute(text("""
            SELECT v.id AS venta_id, lower(trim(pv.metodo_pago)) AS metodo, COALESCE(sum(pv.monto), 0) AS cobrado
            FROM pagos_venta pv JOIN ventas v ON v.id = pv.venta_id
            JOIN estados e ON e.id = v.estado_id AND e.modulo = 'ventas' AND e.nombre = 'Facturada'
            WHERE v.fecha_venta >= :start AND v.fecha_venta < :end
            GROUP BY v.id, lower(trim(pv.metodo_pago))
        """), {"start": start, "end": end}).mappings().all()
        return_rows = db.execute(text("""
            SELECT r.id AS devolucion_id, r.venta_id, r.fecha_devolucion, r.metodo_reembolso,
                   r.estado_reembolso, d.producto_id, d.cantidad, d.monto_devuelto,
                   p.nombre, p.sku, p.marca_id, m.nombre_marca
            FROM devoluciones_venta r
            JOIN ventas v ON v.id=r.venta_id
            JOIN estados e ON e.id=v.estado_id AND e.modulo='ventas' AND e.nombre='Facturada'
            JOIN devoluciones_venta_detalles d ON d.devolucion_id=r.id
            JOIN productos p ON p.id=d.producto_id
            JOIN marcas m ON m.id=p.marca_id
            WHERE r.fecha_devolucion >= :start AND r.fecha_devolucion < :end
            ORDER BY r.id,p.marca_id,d.producto_id
        """), {"start": start, "end": end}).mappings().all()
        charge_rows = db.execute(text("""
            SELECT c.marca_id, m.nombre_marca,
                   COALESCE(sum(c.monto) FILTER (WHERE c.creado_en >= :start AND c.creado_en < :end), 0) AS compras_periodo,
                   (SELECT l.total_deducciones_marca FROM liquidaciones l
                    WHERE l.marca_id=c.marca_id AND l.periodo_inicio=:first AND l.periodo_fin=:last
                    LIMIT 1) AS deducciones_liquidacion,
                   COALESCE(sum(c.monto - COALESCE((
                     SELECT sum(a.monto_aplicado)
                     FROM liquidacion_cargos_marca a
                     WHERE a.cargo_id=c.id
                   ), 0)), 0) AS descuentos_pendientes
            FROM cargos_marca c
            JOIN marcas m ON m.id=c.marca_id
            WHERE c.creado_en < :end
            GROUP BY c.marca_id
        """), {"start": start, "end": end, "first": first, "last": last}).mappings().all()
        charges_by_brand = {row["marca_id"]: row for row in charge_rows}

        sales = {}
        products = {}
        daily_by_brand = {}
        brand_map = {}
        sale_lines = {}
        selected_brands = set(brand_ids)
        for row in product_rows:
            sale_id = row["venta_id"]
            line_amount = _decimal(row["subtotal"])
            sale = sales.setdefault(sale_id, {"subtotal": Decimal("0"), "total": _decimal(row["total"]), "fee": _decimal(row["comision_pos"])})
            sale["subtotal"] += line_amount
            sale_lines.setdefault(sale_id, []).append((row["marca_id"], row["producto_id"], line_amount))
            brand = brand_map.setdefault(row["marca_id"], {
                "marca_id": row["marca_id"], "marca": row["nombre_marca"],
                "ventas_brutas": Decimal("0"), "cantidad": 0,
                "por_metodo": {"efectivo": Decimal("0"), "tarjeta": Decimal("0"), "transferencia": Decimal("0"), "credito": Decimal("0"), "cuenta_marca": Decimal("0")},
                "comision_pos": Decimal("0"),
            })
            method = str(row["metodo_pago"]).strip().lower()
            method_key = "cuenta_marca" if method == "cuenta de marca" else "credito" if method == "crédito" else "tarjeta" if method == "tarjeta" else "transferencia" if method == "transferencia" else "efectivo"
            key = (row["marca_id"], row["producto_id"])
            item = products.setdefault(key, {
                "marca_id": row["marca_id"], "marca": row["nombre_marca"],
                "producto_id": row["producto_id"], "producto": row["nombre"], "sku": row["sku"],
                "cantidad": 0, "bruto": Decimal("0"),
                "metodos": {"efectivo": Decimal("0"), "tarjeta": Decimal("0"), "transferencia": Decimal("0"), "credito": Decimal("0"), "cuenta_marca": Decimal("0")},
                "comision_pos": Decimal("0"),
            })
            item["cantidad"] += int(row["cantidad"])
            item["bruto"] += line_amount
            item["metodos"][method_key] += line_amount
            brand["ventas_brutas"] += line_amount
            brand["cantidad"] += int(row["cantidad"])
            brand["por_metodo"][method_key] += line_amount
            local_day = row["fecha_venta"].replace(tzinfo=timezone.utc).astimezone(MANAGUA).date().isoformat()
            day = daily_by_brand.setdefault((local_day, row["marca_id"]), {"fecha": local_day, "ventas_brutas": Decimal("0"), "cantidad": 0})
            day["ventas_brutas"] += line_amount
            day["cantidad"] += int(row["cantidad"])

        for row in return_rows:
            if brand_ids and row["marca_id"] not in selected_brands:
                continue
            line_amount = _decimal(row["monto_devuelto"])
            quantity = int(row["cantidad"])
            brand = brand_map.setdefault(row["marca_id"], {
                "marca_id": row["marca_id"], "marca": row["nombre_marca"],
                "ventas_brutas": Decimal("0"), "cantidad": 0,
                "por_metodo": {"efectivo": Decimal("0"), "tarjeta": Decimal("0"), "transferencia": Decimal("0"), "credito": Decimal("0"), "cuenta_marca": Decimal("0")},
                "comision_pos": Decimal("0"),
            })
            key = (row["marca_id"], row["producto_id"])
            item = products.setdefault(key, {
                "marca_id": row["marca_id"], "marca": row["nombre_marca"],
                "producto_id": row["producto_id"], "producto": row["nombre"], "sku": row["sku"],
                "cantidad": 0, "bruto": Decimal("0"),
                "metodos": {"efectivo": Decimal("0"), "tarjeta": Decimal("0"), "transferencia": Decimal("0"), "credito": Decimal("0"), "cuenta_marca": Decimal("0")},
                "comision_pos": Decimal("0"),
            })
            method = str(row["metodo_reembolso"]).strip().lower()
            method_key = "cuenta_marca" if method == "cuenta de marca" else "credito" if method == "crédito" else "tarjeta" if method == "tarjeta" else "transferencia" if method == "transferencia" else "efectivo"
            brand["ventas_brutas"] -= line_amount
            brand["cantidad"] -= quantity
            brand["por_metodo"][method_key] -= line_amount
            item["cantidad"] -= quantity
            item["bruto"] -= line_amount
            item["metodos"][method_key] -= line_amount
            local_day = row["fecha_devolucion"].replace(tzinfo=timezone.utc).astimezone(MANAGUA).date().isoformat()
            day = daily_by_brand.setdefault((local_day, row["marca_id"]), {"fecha": local_day, "ventas_brutas": Decimal("0"), "cantidad": 0})
            day["ventas_brutas"] -= line_amount
            day["cantidad"] -= quantity

        for charge in charge_rows:
            brand_map.setdefault(charge["marca_id"], {
                "marca_id": charge["marca_id"], "marca": charge["nombre_marca"],
                "ventas_brutas": Decimal("0"), "cantidad": 0,
                "por_metodo": {"efectivo": Decimal("0"), "tarjeta": Decimal("0"), "transferencia": Decimal("0"), "credito": Decimal("0"), "cuenta_marca": Decimal("0")},
                "comision_pos": Decimal("0"),
            })

        for sale_id, lines in sale_lines.items():
            sale = sales[sale_id]
            if sale["total"] > sale["subtotal"]:
                sale["fee"] = Decimal("0")  # Las ventas antiguas ya cobraron la comisión al cliente.
            allocations = _allocate(sale["fee"], [line[2] for line in lines])
            for (brand_id, product_id, _), fee_share in zip(lines, allocations):
                brand_map[brand_id]["comision_pos"] += fee_share
                products[(brand_id, product_id)]["comision_pos"] += fee_share

        collected = {method: Decimal("0") for method in ("efectivo", "tarjeta", "transferencia")}
        account_sales = Decimal("0")
        for payment_row in payment_rows:
            method = str(payment_row["metodo"])
            if method not in collected and method != "cuenta de marca":
                continue
            weights_by_brand = {}
            for brand_id, _, amount in sale_lines.get(payment_row["venta_id"], []):
                weights_by_brand[brand_id] = weights_by_brand.get(brand_id, Decimal("0")) + amount
            allocations = _allocate(_decimal(payment_row["cobrado"]), list(weights_by_brand.values()))
            for brand_id, amount in zip(weights_by_brand, allocations):
                if not brand_ids or brand_id in selected_brands:
                    if method == "cuenta de marca":
                        account_sales += amount
                    else:
                        collected[method] += amount
        for row in return_rows:
            if row["estado_reembolso"] != "Reembolsado":
                continue
            if brand_ids and row["marca_id"] not in selected_brands:
                continue
            method = str(row["metodo_reembolso"]).strip().lower()
            if method in collected:
                collected[method] -= _decimal(row["monto_devuelto"])
            elif method == "cuenta de marca":
                account_sales -= _decimal(row["monto_devuelto"])
        brands = []
        for brand in brand_map.values():
            commission = Decimal("0.00")
            base_net = brand["ventas_brutas"] - brand["comision_pos"]
            charge = charges_by_brand.get(brand["marca_id"], {})
            pending_charge = _decimal(charge.get("descuentos_pendientes"))
            charge_to_apply = (
                _decimal(charge["deducciones_liquidacion"])
                if charge.get("deducciones_liquidacion") is not None
                else min(max(base_net, Decimal("0")), pending_charge)
            )
            brands.append({
                **brand, "comision_tienda": commission,
                "neto_antes_deducciones": base_net,
                "compras_periodo": _decimal(charge.get("compras_periodo")),
                "descuentos_pendientes": pending_charge,
                "total_deducciones_marca": charge_to_apply,
                "neto_pagar": max(base_net - pending_charge, Decimal("0")),
            })
        if brand_ids:
            brands = [brand for brand in brands if brand["marca_id"] in selected_brands]
            products = {key: item for key, item in products.items() if item["marca_id"] in selected_brands}
            selected_sales = {sale_id for sale_id, lines in sale_lines.items() if any(line[0] in selected_brands for line in lines)}
        else:
            selected_sales = set(sales)
        daily = {}
        for (day_date, brand_id), day in daily_by_brand.items():
            if brand_ids and brand_id not in set(brand_ids):
                continue
            total = daily.setdefault(day_date, {"fecha": day_date, "ventas_brutas": Decimal("0"), "cantidad": 0})
            total["ventas_brutas"] += day["ventas_brutas"]
            total["cantidad"] += day["cantidad"]
        gross = sum((row["ventas_brutas"] for row in brands), Decimal("0"))
        store_commission = sum((row["comision_tienda"] for row in brands), Decimal("0"))
        pos_fee = sum((row["comision_pos"] for row in brands), Decimal("0"))
        brand_deductions = sum((row["total_deducciones_marca"] for row in brands), Decimal("0"))
        for brand in brands:
            product_rows_for_brand = sorted(
                (item for item in products.values() if item["marca_id"] == brand["marca_id"]),
                key=lambda item: item["producto"].casefold(),
            )
            for item in product_rows_for_brand:
                item["comision_tienda"] = Decimal("0.00")
                item["neto_marca"] = item["bruto"] - item["comision_pos"]
        result = {
            "periodo": period or f"{first.isoformat()}..{last.isoformat()}",
            "resumen": {
                "ventas_brutas": gross,
                "comision_tienda": store_commission,
                "neto_marcas": gross - pos_fee - brand_deductions,
                "comision_pos": pos_fee,
                "deducciones_compras": brand_deductions,
                "cobrado_efectivo": collected.get("efectivo", Decimal("0")),
                "cobrado_tarjeta": collected.get("tarjeta", Decimal("0")),
                "cobrado_transferencia": collected.get("transferencia", Decimal("0")),
                "venta_a_cuenta_marca": account_sales,
                "transacciones": len(selected_sales),
            },
            "por_dia": sorted(daily.values(), key=lambda row: row["fecha"]),
            "por_marca": sorted(brands, key=lambda row: row["marca"].casefold()),
            "por_producto": sorted(products.values(), key=lambda row: (row["marca"].casefold(), row["producto"].casefold())),
        }
        if _compare and period:
            previous_first = first - timedelta(days=1)
            previous_period = previous_first.strftime("%Y-%m")
            previous = LiquidacionesService.report(db, previous_period, _compare=False, brand_ids=brand_ids)["resumen"]
            previous_gross = previous["ventas_brutas"]
            result["comparacion_mes_anterior"] = {
                "periodo": previous_period,
                "ventas_brutas_anterior": previous_gross,
                "variacion_ventas": gross - previous_gross,
                "variacion_ventas_pct": ((gross - previous_gross) * Decimal("100") / previous_gross).quantize(CENT, rounding=ROUND_HALF_UP) if previous_gross else None,
                "transacciones_anterior": previous["transacciones"],
                "variacion_transacciones": len(sales) - previous["transacciones"],
            }
        return result

    @staticmethod
    def generate_brand_excel(db: Session, brand_id: int, period: str) -> tuple[bytes, str]:
        brand_info = db.execute(text("""
            SELECT id, nombre_marca, codigo, categoria, nombre_representante, email, telefono, logo
            FROM marcas WHERE id = :brand_id
        """), {"brand_id": brand_id}).mappings().first()
        if not brand_info:
            raise HTTPException(status_code=404, detail="Marca no encontrada.")

        report = LiquidacionesService.report(db, period, _compare=False)
        brand = next((item for item in report["por_marca"] if item["marca_id"] == brand_id), None)
        if not brand:
            raise HTTPException(status_code=404, detail="La marca no tiene ventas en ese período.")
        products = [item for item in report["por_producto"] if item["marca_id"] == brand_id]
        settlement = next((item for item in LiquidacionesService.list_for_period(db, period) if item["marca_id"] == brand_id), None)
        first, last = _period(period)
        start, end = utc_naive_bounds(first, last + timedelta(days=1))
        sales = db.execute(text("""
            SELECT v.id AS venta_id, v.fecha_venta, v.total AS total_venta, v.comision_pos,
                   m.nombre_marca AS marca, p.nombre AS producto, p.sku, p.tamano,
                   p.detalles_rubro->>'color' AS color,
                   vd.cantidad, vd.precio_unitario, vd.descuento, vd.subtotal,
                   COALESCE(pagos.metodos_pago, '—') AS metodos_pago,
                   (SELECT sum(vd_all.subtotal) FROM venta_detalles vd_all WHERE vd_all.venta_id = v.id) AS subtotal_venta
            FROM ventas v
            JOIN estados e ON e.id = v.estado_id AND e.modulo = 'ventas' AND e.nombre = 'Facturada'
            JOIN venta_detalles vd ON vd.venta_id = v.id
            JOIN productos p ON p.id = vd.producto_id
            JOIN marcas m ON m.id = p.marca_id
            LEFT JOIN LATERAL (
                SELECT string_agg(DISTINCT pv.metodo_pago, ' | ' ORDER BY pv.metodo_pago) AS metodos_pago
                FROM pagos_venta pv WHERE pv.venta_id = v.id
            ) pagos ON true
            WHERE p.marca_id = :brand_id AND v.fecha_venta >= :start AND v.fecha_venta < :end
            ORDER BY v.fecha_venta, v.id, vd.id
        """), {"brand_id": brand_id, "start": start, "end": end}).mappings().all()

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Liquidacion_Marca"
        ws.sheet_view.showGridLines = False
        ws.freeze_panes = "A11"
        rose, pink, blush, gold = "FFFFFF", "FFFFFF", "FFFFFF", "C9A46D"
        white, ink, muted, line = "FFFFFF", "493A35", "786963", "E8D8D1"
        zebra, gold_light = "FFFAF8", "F8F0E4"
        border = Border(*(Side(style="thin", color=line) for _ in range(4)))
        widths = [7, 18, 34, 13, 18, 18, 18, 21, 17, 18, 19]
        for index, width in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(index)].width = width

        ws.row_dimensions[1].height = 10
        ws.row_dimensions[2].height = 36
        ws.row_dimensions[3].height = 24
        ws.merge_cells("A2:A3")
        logo_inserted = False
        if brand_info["logo"]:
            # ponytail: the logo is decorative; the brand initials keep the workbook usable when Storage is unavailable.
            try:
                logo_bytes = download_image(brand_info["logo"])
                with PILImage.open(BytesIO(logo_bytes)) as image:
                    ratio = min(82 / image.width, 50 / image.height, 1.0)
                    size = (int(image.width * ratio), int(image.height * ratio))
                logo = OpenpyxlImage(BytesIO(logo_bytes))
                logo.width, logo.height = size
                ws.add_image(logo, "A2")
                logo_inserted = True
            except Exception:
                pass
        if not logo_inserted:
            mark = (brand_info["codigo"] or brand_info["nombre_marca"][:3]).upper()[:3]
            cell = ws["A2"]
            cell.value = mark
            cell.font = Font(name="Segoe UI", size=14, bold=True, color=white)
            cell.fill = PatternFill("solid", fgColor=gold)
            cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.merge_cells("B2:H2")
        ws["B2"] = "LIQUIDACIÓN MENSUAL · DETALLE DE VENTAS"
        ws["B2"].font = Font(name="Segoe UI", size=16, bold=True, color=ink)
        ws["B2"].alignment = Alignment(vertical="center")
        ws.merge_cells("B3:H3")
        ws["B3"] = f"Estado de cuenta para {brand_info['nombre_marca']} · {brand_info['codigo'] or 'MARCA'}"
        ws["B3"].font = Font(name="Segoe UI", size=10, color=muted)
        ws["B3"].alignment = Alignment(vertical="center")
        ws.merge_cells("I2:L2")
        ws["I2"] = "LIQUIDACIÓN POR MARCA"
        ws["I2"].font = Font(name="Segoe UI", size=9, bold=True, color=ink)
        ws["I2"].fill = PatternFill("solid", fgColor=blush)
        ws["I2"].alignment = Alignment(horizontal="center", vertical="center")
        ws.merge_cells("I3:L3")
        ws["I3"] = f"Período {period} · {datetime.now(MANAGUA):%d/%m/%Y}"
        ws["I3"].font = Font(name="Segoe UI", size=9, color=muted)
        ws["I3"].fill = PatternFill("solid", fgColor=gold_light)
        ws["I3"].alignment = Alignment(horizontal="center", vertical="center")

        ws.merge_cells("A5:L5")
        ws["A5"] = "DATOS DE LA MARCA"
        ws["A5"].font = Font(name="Segoe UI", size=10, bold=True, color=ink)
        ws["A5"].fill = PatternFill("solid", fgColor=pink)
        ws["A5"].alignment = Alignment(vertical="center")
        details = [
            ("A6", "Marca"), ("B6", brand_info["nombre_marca"]), ("D6", "Código"), ("E6", brand_info["codigo"] or "—"),
            ("G6", "Categoría"), ("H6", brand_info["categoria"] or "General"),
            ("A7", "Representante"), ("B7", brand_info["nombre_representante"] or "—"),
            ("D7", "Correo"), ("E7", brand_info["email"] or "—"), ("G7", "Teléfono"), ("H7", brand_info["telefono"] or "—"),
        ]
        for address, value in details:
            cell = ws[address]
            cell.value = value
            cell.border = border
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.font = Font(name="Segoe UI", size=9, bold=address[0] in "ADG", color=ink if address[0] in "ADG" else muted)
            if address[0] in "ADG":
                cell.fill = PatternFill("solid", fgColor=gold_light)
        for row in (6, 7):
            ws.row_dimensions[row].height = 25
        for area in ("B6:C6", "E6:F6", "H6:K6", "B7:C7", "E7:F7", "H7:K7"):
            ws.merge_cells(area)

        summary_cells = [
            ("A8:B8", "VENTAS BRUTAS", "C8", brand["ventas_brutas"]),
            ("D8:E8", "COMPRAS DESCONTADAS", "F8", brand["total_deducciones_marca"]),
            ("G8:H8", "NETO PARA LA MARCA", "I8:L8", brand["neto_pagar"]),
        ]
        for labels_range, label, amount_range, amount in summary_cells:
            ws.merge_cells(labels_range)
            ws.merge_cells(amount_range)
            label_cell = ws[labels_range.split(":")[0]]
            amount_cell = ws[amount_range.split(":")[0]]
            label_cell.value = label
            label_cell.font = Font(name="Segoe UI", size=9, bold=True, color=ink)
            label_cell.fill = PatternFill("solid", fgColor=gold_light)
            label_cell.alignment = Alignment(vertical="center", horizontal="center")
            amount_cell.value = float(amount)
            amount_cell.number_format = '"C$"#,##0.00'
            amount_cell.font = Font(name="Segoe UI", size=11, bold=True, color=ink)
            amount_cell.fill = PatternFill("solid", fgColor=blush)
            amount_cell.alignment = Alignment(vertical="center", horizontal="center")
        ws.row_dimensions[8].height = 30

        ws.merge_cells("A9:L9")
        payment_status = settlement["estado"] if settlement else "Sin liquidación generada"
        ws["A9"] = f"ESTADO: {payment_status} · Comisión POS: C$ {brand['comision_pos']:,.2f} · Saldo de compras pendiente: C$ {brand['descuentos_pendientes'] - brand['total_deducciones_marca']:,.2f}."
        ws["A9"].font = Font(name="Segoe UI", size=9, bold=True, color=ink)
        ws["A9"].fill = PatternFill("solid", fgColor=blush)
        ws["A9"].alignment = Alignment(vertical="center", wrap_text=True)
        ws.row_dimensions[9].height = 25

        headers = ["#", "SKU / CÓDIGO", "PRODUCTO", "UNIDADES", "VENTAS BRUTAS", "EFECTIVO", "TARJETA", "TRANSFERENCIA", "CR?DITO", "CUENTA MARCA", "COMISIÓN POS", "NETO MARCA"]
        for column, label in enumerate(headers, start=1):
            cell = ws.cell(10, column, label)
            cell.font = Font(name="Segoe UI", size=9, bold=True, color=white if column >= 5 else ink)
            cell.fill = PatternFill("solid", fgColor=gold if column >= 5 else rose)
            cell.border = border
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.row_dimensions[10].height = 38

        start_row = 11
        for index, item in enumerate(products, start=1):
            row = start_row + index - 1
            values = [index, item.get("sku") or "—", item["producto"], item["cantidad"], item["bruto"],
                      item["metodos"]["efectivo"], item["metodos"]["tarjeta"], item["metodos"]["transferencia"], item["metodos"]["credito"], item["metodos"]["cuenta_marca"],
                      item["comision_pos"], item["neto_marca"]]
            ws.row_dimensions[row].height = 25
            for column, value in enumerate(values, start=1):
                cell = ws.cell(row, column, float(value) if isinstance(value, Decimal) else value)
                cell.font = Font(name="Segoe UI", size=9, color=muted if column == 1 else ink)
                cell.fill = PatternFill("solid", fgColor=zebra if index % 2 == 0 else white)
                cell.border = border
                cell.alignment = Alignment(vertical="center", horizontal="right" if column >= 4 else "left", wrap_text=column in (2, 3))
                if column >= 5:
                    cell.number_format = '"C$"#,##0.00'
            ws.cell(row, 4).number_format = "0"

        total_row = start_row + len(products)
        ws.merge_cells(start_row=total_row, start_column=1, end_row=total_row, end_column=3)
        total_label = ws.cell(total_row, 1, "TOTAL DEL PERÍODO")
        total_label.font = Font(name="Segoe UI", size=9, bold=True, color=white)
        total_label.fill = PatternFill("solid", fgColor=gold)
        total_label.alignment = Alignment(horizontal="right", vertical="center")
        totals = [brand["cantidad"], brand["ventas_brutas"], brand["por_metodo"]["efectivo"], brand["por_metodo"]["tarjeta"],
                  brand["por_metodo"]["transferencia"], brand["por_metodo"]["credito"], brand["por_metodo"]["cuenta_marca"], brand["comision_pos"], brand["neto_pagar"]]
        for column, value in enumerate(totals, start=4):
            cell = ws.cell(total_row, column, int(value) if column == 4 else float(value))
            cell.font = Font(name="Segoe UI", size=9, bold=True, color=white)
            cell.fill = PatternFill("solid", fgColor=gold)
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.number_format = "0" if column == 4 else '"C$"#,##0.00'
        ws.row_dimensions[total_row].height = 27

        ws.auto_filter.ref = f"A10:L{total_row - 1}"
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.page_setup.orientation = "landscape"
        ws.print_title_rows = "1:10"
        ws.print_area = f"A1:L{total_row}"
        ws.oddFooter.center.text = "Moon Concept Store · Liquidación mensual"
        ws.oddFooter.right.text = "Página &[Page] de &[Pages]"

        sales_ws = wb.create_sheet("Ventas_Detalladas")
        sales_ws.sheet_view.showGridLines = False
        sales_ws.freeze_panes = "A2"
        sales_headers = ["FECHA", "MARCA", "CÓDIGO", "SALIDA", "DESCRIPCIÓN", "TALLA", "COLOR", "TIPO_VENTA", "MONTO", "COMISIÓN BANCARIA", "DESCUENTO", "TOTAL"]
        sales_widths = [20, 24, 18, 12, 34, 12, 16, 22, 16, 20, 16, 16]
        for column, (label, width) in enumerate(zip(sales_headers, sales_widths), start=1):
            cell = sales_ws.cell(1, column, label)
            cell.font = Font(name="Segoe UI", size=9, bold=True, color=ink)
            cell.fill = PatternFill("solid", fgColor=gold_light)
            cell.border = border
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            sales_ws.column_dimensions[get_column_letter(column)].width = width
        sales_ws.row_dimensions[1].height = 34
        fee_allocations = {}
        grouped_sales = {}
        for sale_line in sales:
            grouped_sales.setdefault(sale_line["venta_id"], []).append(sale_line)
        for sale_lines in grouped_sales.values():
            fee = _decimal(sale_lines[0]["comision_pos"])
            if _decimal(sale_lines[0]["total_venta"]) > _decimal(sale_lines[0]["subtotal_venta"]):
                fee = Decimal("0")  # ponytail: old sales already charged the fee to the customer.
            brand_subtotal = sum((_decimal(line["subtotal"]) for line in sale_lines), Decimal("0"))
            full_subtotal = _decimal(sale_lines[0]["subtotal_venta"])
            brand_fee = _allocate(fee, [brand_subtotal, max(full_subtotal - brand_subtotal, Decimal("0"))])[0]
            fee_allocations.update({id(line): amount for line, amount in zip(
                sale_lines, _allocate(brand_fee, [_decimal(line["subtotal"]) for line in sale_lines])
            )})
        for row_index, sale_line in enumerate(sales, start=2):
            # ponytail: Excel stores the Managua wall time without timezone metadata.
            sale_date = sale_line["fecha_venta"].replace(tzinfo=timezone.utc).astimezone(MANAGUA).replace(tzinfo=None)
            gross = _decimal(sale_line["precio_unitario"]) * int(sale_line["cantidad"])
            values = [sale_date, sale_line["marca"], sale_line["sku"] or "—", sale_line["cantidad"], sale_line["producto"],
                      sale_line["tamano"] or "—", sale_line["color"] or "—", sale_line["metodos_pago"], gross,
                      fee_allocations[id(sale_line)], sale_line["descuento"], sale_line["subtotal"]]
            for column, value in enumerate(values, start=1):
                cell = sales_ws.cell(row_index, column, float(value) if isinstance(value, Decimal) else value)
                cell.font = Font(name="Segoe UI", size=9, color=ink)
                cell.fill = PatternFill("solid", fgColor=zebra if row_index % 2 == 0 else white)
                cell.border = border
                cell.alignment = Alignment(vertical="center", horizontal="right" if column in (4, 9, 10, 11, 12) else "left", wrap_text=column in (2, 5, 8))
                if column == 1:
                    cell.number_format = "dd/mm/yyyy hh:mm"
                elif column in (9, 10, 11, 12):
                    cell.number_format = '"C$"#,##0.00'
            sales_ws.row_dimensions[row_index].height = 25
        if sales:
            totals_row = len(sales) + 2
            sales_ws.merge_cells(start_row=totals_row, start_column=1, end_row=totals_row, end_column=3)
            total_label = sales_ws.cell(totals_row, 1, "TOTALES")
            total_label.alignment = Alignment(horizontal="right", vertical="center")
            total_label.font = Font(name="Segoe UI", size=9, bold=True, color=white)
            for column, amount in (
                (4, sum(int(row["cantidad"]) for row in sales)),
                (9, sum((_decimal(row["precio_unitario"]) * int(row["cantidad"]) for row in sales), Decimal("0"))),
                (10, sum(fee_allocations.values(), Decimal("0"))),
                (11, sum((_decimal(row["descuento"]) for row in sales), Decimal("0"))),
                (12, sum((_decimal(row["subtotal"]) for row in sales), Decimal("0"))),
            ):
                cell = sales_ws.cell(totals_row, column, float(amount) if isinstance(amount, Decimal) else amount)
                cell.number_format = "0" if column == 4 else '"C$"#,##0.00'
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.font = Font(name="Segoe UI", size=9, bold=True, color=white)
            for row in sales_ws.iter_rows(min_row=totals_row, max_row=totals_row, min_col=1, max_col=12):
                for cell in row:
                    cell.fill = PatternFill("solid", fgColor=gold)
                    cell.border = border
            sales_ws.row_dimensions[totals_row].height = 27
            sales_ws.auto_filter.ref = f"A1:L{len(sales) + 1}"
        sales_ws.sheet_properties.pageSetUpPr.fitToPage = True
        sales_ws.page_setup.fitToWidth = 1
        sales_ws.page_setup.fitToHeight = 0
        sales_ws.page_setup.orientation = "landscape"
        wb.properties.creator = "Moon Concept Store"
        output = BytesIO()
        wb.save(output)
        safe_brand = unicodedata.normalize("NFKD", brand_info["nombre_marca"]).encode("ascii", "ignore").decode()
        safe_brand = re.sub(r"[^A-Za-z0-9_-]+", "_", safe_brand).strip("_") or f"marca_{brand_id}"
        return output.getvalue(), f"Liquidacion_{safe_brand}_{period}.xlsx"

    @staticmethod
    def list_for_period(db: Session, period: str) -> list[dict]:
        first, last = _period(period)
        rows = db.execute(text("""
            SELECT l.id, l.marca_id, m.nombre_marca, l.periodo_inicio, l.periodo_fin,
                   l.total_bruto, l.total_comision_pos, l.total_comision_tienda, l.total_deducciones_marca,
                   l.total_neto_pagar, e.nombre AS estado, l.fecha_pago,
                   l.referencia_pago, c.banco, c.no_cuenta
            FROM liquidaciones l JOIN marcas m ON m.id = l.marca_id
            JOIN estados e ON e.id = l.estado_id
            LEFT JOIN LATERAL (SELECT banco, no_cuenta FROM cuentas WHERE marca_id = l.marca_id ORDER BY id LIMIT 1) c ON true
            WHERE l.periodo_inicio = :first AND l.periodo_fin = :last
            ORDER BY m.nombre_marca
        """), {"first": first, "last": last}).mappings().all()
        return [dict(row) for row in rows]

    @staticmethod
    def generate(db: Session, period: str, brand_ids: list[int] | None = None) -> list[dict]:
        first, last = _period(period)
        current_month = datetime.now(MANAGUA).date().replace(day=1)
        if first >= current_month:
            raise HTTPException(status_code=422, detail="Solo se pueden generar liquidaciones de meses ya finalizados.")
        report = LiquidacionesService.report(db, period)
        selected_ids = sorted(set(brand_ids)) if brand_ids is not None else None
        if selected_ids == []:
            raise HTTPException(status_code=422, detail="Selecciona al menos una marca.")
        brands_to_generate = [brand for brand in report["por_marca"]
                              if brand["neto_antes_deducciones"] > 0
                              and (selected_ids is None or brand["marca_id"] in selected_ids)]
        if not brands_to_generate:
            raise HTTPException(status_code=422, detail="No hay ventas registradas en ese período.")
        try:
            lock_day(db, first)
            pending_id = db.execute(text("SELECT id FROM estados WHERE modulo = 'liquidaciones' AND nombre = 'Pendiente' ORDER BY id LIMIT 1")).scalar()
            if pending_id is None:
                raise HTTPException(status_code=500, detail="Falta configurar el estado Pendiente de liquidaciones.")
            for brand in brands_to_generate:
                # ponytail: oldest unpaid brand invoices consume available settlement proceeds first.
                db.execute(text("SELECT pg_advisory_xact_lock(:namespace, :brand_id)"),
                           {"namespace": 19841024, "brand_id": brand["marca_id"]})
                period_end = utc_naive_bounds(last + timedelta(days=1), last + timedelta(days=2))[0]
                pending_charge = _decimal(db.execute(text("""
                    SELECT COALESCE(sum(c.monto - COALESCE((
                      SELECT sum(a.monto_aplicado) FROM liquidacion_cargos_marca a WHERE a.cargo_id=c.id
                    ), 0)), 0)
                    FROM cargos_marca c
                    WHERE c.marca_id=:brand_id AND c.creado_en < :end
                """), {"brand_id": brand["marca_id"], "end": period_end}).scalar_one())
                brand["descuentos_pendientes"] = pending_charge
                brand["total_deducciones_marca"] = min(max(brand["neto_antes_deducciones"], Decimal("0")), pending_charge)
                brand["neto_pagar"] = max(brand["neto_antes_deducciones"] - brand["total_deducciones_marca"], Decimal("0"))
                settlement_id = db.execute(text("""
                    INSERT INTO liquidaciones
                    (marca_id, periodo_inicio, periodo_fin, total_bruto, total_comision_pos,
                     total_comision_tienda, total_neto_pagar, total_deducciones_marca, estado_id)
                    VALUES (:brand_id, :first, :last, :gross, :pos_fee, :store_fee, :net, :deductions, :state_id)
                    ON CONFLICT (marca_id, periodo_inicio, periodo_fin) DO NOTHING RETURNING id
                """), {
                    "brand_id": brand["marca_id"], "first": first, "last": last,
                    "gross": brand["ventas_brutas"], "pos_fee": brand["comision_pos"],
                    "store_fee": brand["comision_tienda"], "net": brand["neto_pagar"],
                    "deductions": brand["total_deducciones_marca"], "state_id": pending_id,
                }).scalar()
                if settlement_id is None:
                    continue
                remaining_deduction = brand["total_deducciones_marca"]
                cargo_rows = db.execute(text("""
                    SELECT c.id, c.monto - COALESCE(aplicado.monto, 0) AS pendiente
                    FROM cargos_marca c
                    LEFT JOIN LATERAL (
                      SELECT sum(a.monto_aplicado) AS monto
                      FROM liquidacion_cargos_marca a
                      WHERE a.cargo_id=c.id
                    ) aplicado ON true
                    WHERE c.marca_id=:brand_id AND c.creado_en < :end
                      AND c.monto > COALESCE(aplicado.monto, 0)
                    ORDER BY c.creado_en, c.id
                    FOR UPDATE OF c
                    """), {"brand_id": brand["marca_id"], "end": period_end}).mappings().all()
                for cargo in cargo_rows:
                    if remaining_deduction <= 0:
                        break
                    amount = min(remaining_deduction, _decimal(cargo["pendiente"]))
                    if amount <= 0:
                        continue
                    db.execute(text("""
                        INSERT INTO liquidacion_cargos_marca (cargo_id, liquidacion_id, monto_aplicado)
                        VALUES (:cargo_id, :settlement_id, :amount)
                    """), {"cargo_id": cargo["id"], "settlement_id": settlement_id, "amount": amount})
                    remaining_deduction -= amount
                detail_items = db.execute(text("""
                   SELECT p.marca_id, vd.producto_id, vd.cantidad, vd.subtotal,
                           mp.metodo_pago, v.id AS venta_id, v.comision_pos, v.total,
                           (SELECT sum(vd_all.subtotal) FROM venta_detalles vd_all WHERE vd_all.venta_id = v.id) AS subtotal_venta
                    FROM ventas v JOIN estados e ON e.id = v.estado_id AND e.modulo = 'ventas' AND e.nombre = 'Facturada'
                    JOIN venta_detalles vd ON vd.venta_id = v.id JOIN productos p ON p.id = vd.producto_id
                    JOIN pagos_venta pv ON pv.venta_id = v.id JOIN metodo_pago mp ON lower(mp.metodo_pago) = lower(pv.metodo_pago)
                    WHERE p.marca_id = :brand_id AND v.fecha_venta >= :start AND v.fecha_venta < :end
                    ORDER BY vd.producto_id, v.id
                """), {"brand_id": brand["marca_id"], **dict(zip(("start", "end"), utc_naive_bounds(first, last + timedelta(days=1))))}).mappings().all()
                detail_groups = {}
                detail_sales = {}
                for item in detail_items:
                    pid = item["producto_id"]
                    detail = detail_groups.setdefault(pid, {
                        "settlement_id": settlement_id, "product_id": pid, "quantity": 0,
                "cash": Decimal("0"), "card": Decimal("0"), "transfer": Decimal("0"), "credit": Decimal("0"), "account": Decimal("0"), "pos_fee": Decimal("0"),
                        "gross": Decimal("0"),
                    })
                    amount = _decimal(item["subtotal"])
                    detail["quantity"] += int(item["cantidad"])
                    detail["gross"] += amount
                    method = str(item["metodo_pago"]).strip().lower()
                    key = "account" if method == "cuenta de marca" else "credit" if method == "crédito" else "card" if method == "tarjeta" else "transfer" if method == "transferencia" else "cash"
                    detail[key] += amount
                    detail_sales.setdefault(item["venta_id"], []).append((pid, amount, _decimal(item["comision_pos"]), _decimal(item["total"]), _decimal(item["subtotal_venta"])))
                for sale_lines in detail_sales.values():
                    fee = sale_lines[0][2]
                    if sale_lines[0][3] > sale_lines[0][4]:
                        fee = Decimal("0")  # ponytail: old sales already charged the fee to the customer.
                    brand_subtotal = sum((line[1] for line in sale_lines), Decimal("0"))
                    brand_fee = _allocate(fee, [brand_subtotal, max(sale_lines[0][4] - brand_subtotal, Decimal("0"))])[0]
                    allocations = _allocate(brand_fee, [line[1] for line in sale_lines])
                    for (pid, _, _, _, _), allocated_fee in zip(sale_lines, allocations):
                        detail_groups[pid]["pos_fee"] += allocated_fee
                for detail in detail_groups.values():
                    detail["store_fee"] = Decimal("0.00")
                    detail["net"] = detail["gross"] - detail["pos_fee"]
                    db.execute(text("""
                        INSERT INTO liquidacion_detalles
                        (liquidacion_id, producto_id, cantidad_vendida, monto_efectivo, monto_tarjeta,
                         monto_transferencia, monto_credito, monto_cuenta_marca, comision_pos, comision_tienda, subtotal_neto)
                        VALUES (:settlement_id, :product_id, :quantity, :cash, :card, :transfer, :credit, :account,
                                :pos_fee, :store_fee, :net)
                    """), {
                        **detail
                    })
            db.commit()
            settlements = LiquidacionesService.list_for_period(db, period)
            return [item for item in settlements if selected_ids is None or item["marca_id"] in selected_ids]
        except HTTPException:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def generate_and_export(db: Session, period: str, brand_ids: list[int]) -> tuple[bytes, str, int, int]:
        selected_ids = sorted(set(brand_ids))
        if not selected_ids:
            raise HTTPException(status_code=422, detail="Selecciona al menos una marca.")
        report = LiquidacionesService.report(db, period)
        sales_brand_ids = {brand["marca_id"] for brand in report["por_marca"]}
        export_ids = [brand_id for brand_id in selected_ids if brand_id in sales_brand_ids]
        if not export_ids:
            raise HTTPException(status_code=422, detail="No hay ventas de las marcas seleccionadas en ese mes.")
        LiquidacionesService.generate(db, period, export_ids)
        output = BytesIO()
        with ZipFile(output, "w", ZIP_DEFLATED) as archive:
            for brand_id in export_ids:
                content, filename = LiquidacionesService.generate_brand_excel(db, brand_id, period)
                archive.writestr(filename, content)
        return output.getvalue(), f"Liquidaciones_{period}.zip", len(export_ids), len(selected_ids) - len(export_ids)

    @staticmethod
    def mark_paid(db: Session, settlement_id: int, payment_date: date, reference: str) -> dict:
        if payment_date > datetime.now(MANAGUA).date():
            raise HTTPException(status_code=422, detail="La fecha de pago no puede ser futura.")
        if not reference.strip():
            raise HTTPException(status_code=422, detail="La referencia de pago es obligatoria.")
        state_id = db.execute(text("SELECT id FROM estados WHERE modulo = 'liquidaciones' AND nombre = 'Pagado' ORDER BY id LIMIT 1")).scalar()
        if state_id is None:
            raise HTTPException(status_code=500, detail="Falta configurar el estado Pagado de liquidaciones.")
        result = db.execute(text("""
            UPDATE liquidaciones SET estado_id = :state_id, fecha_pago = :payment_date, referencia_pago = :reference
            WHERE id = :id AND estado_id <> :state_id RETURNING id
        """), {"state_id": state_id, "payment_date": payment_date, "reference": reference.strip(), "id": settlement_id}).scalar()
        if result is None:
            db.rollback()
            exists = db.execute(text("SELECT 1 FROM liquidaciones WHERE id = :id"), {"id": settlement_id}).first()
            if not exists:
                raise HTTPException(status_code=404, detail="No se encontró la liquidación.")
            raise HTTPException(status_code=409, detail="La liquidación ya está pagada.")
        db.commit()
        row = db.execute(text("""
            SELECT l.id, l.marca_id, m.nombre_marca, l.periodo_inicio, l.periodo_fin, l.total_bruto,
                   l.total_comision_pos, l.total_comision_tienda, l.total_deducciones_marca, l.total_neto_pagar,
                   e.nombre AS estado, l.fecha_pago, l.referencia_pago
            FROM liquidaciones l JOIN marcas m ON m.id = l.marca_id JOIN estados e ON e.id = l.estado_id
            WHERE l.id = :id
        """), {"id": settlement_id}).mappings().one()
        return dict(row)
