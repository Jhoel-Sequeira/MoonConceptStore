import os
from decimal import Decimal

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "local-pricing-check")

from app.services.pos_service import _calculate_line_amounts


assert _calculate_line_amounts(Decimal("100"), 2, Decimal("0"), Decimal("10")) == (
    Decimal("200.00"), Decimal("20.00"), Decimal("180.00"),
)
assert _calculate_line_amounts(Decimal("100"), 2, Decimal("5"), Decimal("0")) == (
    Decimal("200.00"), Decimal("10.00"), Decimal("190.00"),
)
try:
    _calculate_line_amounts(Decimal("100"), 1, Decimal("101"), Decimal("0"))
except ValueError:
    pass
else:
    raise AssertionError("A fixed discount greater than the unit price must be rejected")
