from decimal import Decimal

from app.services.marcas_service import _net_brand_sales


assert _net_brand_sales(Decimal("12.50"), None) == Decimal("12.50")
assert _net_brand_sales(None, Decimal("1.50")) == Decimal("-1.50")
assert _net_brand_sales(None, None) == Decimal("0")
print("Cálculo de ventas netas de marcas: OK")
