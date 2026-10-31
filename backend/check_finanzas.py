from datetime import datetime
from decimal import Decimal
from io import BytesIO

from openpyxl import load_workbook

from app.services.cierre_caja_service import utc_naive_bounds
from app.services.liquidaciones_service import LiquidacionesService, _allocate
from app.services.renta_service import _contract_due_date, _due_date, _period
from app.schemas.renta import RentaConfigUpsert


assert _allocate(Decimal("0.05"), [Decimal("0.05"), Decimal("0.05"), Decimal("0.05")]) == [
    Decimal("0.02"), Decimal("0.02"), Decimal("0.01")
]
assert sum(_allocate(Decimal("17.43"), [Decimal("1"), Decimal("2"), Decimal("3")])) == Decimal("17.43")
assert utc_naive_bounds(datetime(2026, 3, 1).date(), datetime(2026, 4, 1).date()) == (
    datetime(2026, 3, 1, 6), datetime(2026, 4, 1, 6)
)
february_first, february_last = _period("2026-02")
assert _due_date(february_first, february_last, 31).isoformat() == "2026-02-28"
assert _contract_due_date(february_first, february_last, 1, datetime(2026, 2, 10).date()).isoformat() == "2026-02-10"
assert RentaConfigUpsert(
    marca_id=1, monto_mensual="100.00", fecha_inicio="2026-02-01", fecha_fin="2026-02-28"
).fecha_fin.isoformat() == "2026-02-28"


class _BrandResult:
    def mappings(self):
        return self

    def first(self):
        return {
            "id": 1, "nombre_marca": "Marca Demo", "codigo": "MD", "categoria": "General",
            "nombre_representante": "Representante", "email": "demo@example.com", "telefono": "555-0100", "logo": None,
        }

    def all(self):
        return [{
            "venta_id": 17, "fecha_venta": datetime(2026, 9, 12, 18, 0), "total_venta": Decimal("10.00"),
            "cliente": "Cliente Demo", "producto": "Producto Demo", "sku": "SKU-4", "cantidad": 2,
            "precio_unitario": Decimal("5.00"), "descuento": Decimal("0.00"), "subtotal": Decimal("10.00"),
            "metodos_pago": "Efectivo: C$ 10.00",
        }]


class _BrandDb:
    def execute(self, *_args, **_kwargs):
        return _BrandResult()


brand_report = {
    "por_marca": [{
        "marca_id": 1, "marca": "Marca Demo", "cantidad": 2, "ventas_brutas": Decimal("10.00"),
        "comision_tienda": Decimal("2.00"), "neto_pagar": Decimal("8.00"), "comision_pos": Decimal("0.00"),
        "por_metodo": {"efectivo": Decimal("10.00"), "tarjeta": Decimal("0.00"), "transferencia": Decimal("0.00")},
    }],
    "por_producto": [{
        "marca_id": 1, "producto_id": 4, "producto": "Producto Demo", "sku": "SKU-4", "cantidad": 2,
        "bruto": Decimal("10.00"), "metodos": {"efectivo": Decimal("10.00"), "tarjeta": Decimal("0.00"), "transferencia": Decimal("0.00")},
        "comision_pos": Decimal("0.00"), "comision_tienda": Decimal("2.00"), "neto_marca": Decimal("8.00"),
    }],
}
_report = LiquidacionesService.__dict__["report"]
_list_for_period = LiquidacionesService.__dict__["list_for_period"]
LiquidacionesService.report = staticmethod(lambda *_args, **_kwargs: brand_report)
LiquidacionesService.list_for_period = staticmethod(lambda *_args, **_kwargs: [])
try:
    workbook_bytes, workbook_name = LiquidacionesService.generate_brand_excel(_BrandDb(), 1, "2026-09")
finally:
    LiquidacionesService.report = _report
    LiquidacionesService.list_for_period = _list_for_period
sheet = load_workbook(BytesIO(workbook_bytes), data_only=True)["Liquidacion_Marca"]
assert workbook_name == "Liquidacion_Marca_Demo_2026-09.xlsx"
assert sheet["B2"].value == "LIQUIDACIÓN MENSUAL · DETALLE DE VENTAS"
assert sheet["A10"].fill.fgColor.rgb.endswith("FFFFFF") and sheet["A10"].font.color.rgb.endswith("493A35")
assert sheet["E10"].fill.fgColor.rgb.endswith("C9A46D")
assert sheet["J12"].value == 2.0 and sheet["K12"].value == 8.0
sales_sheet = load_workbook(BytesIO(workbook_bytes), data_only=True)["Ventas_Detalladas"]
assert sales_sheet["A2"].value == 17 and sales_sheet["C2"].value == "Cliente Demo"
assert sales_sheet["F2"].value == "Producto Demo" and sales_sheet["J2"].value == 10.0
assert sales_sheet["B2"].value.hour == 12 and sales_sheet["B2"].value.tzinfo is None
assert sales_sheet["A3"].value == "TOTALES" and sales_sheet["G3"].value == 2
assert sales_sheet["J3"].value == 10.0 and sales_sheet["K3"].value == 10.0
