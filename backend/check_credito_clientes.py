"""Small, dependency-light contract check for customer credit payments."""

from decimal import Decimal

from pydantic import ValidationError

from app.schemas.clientes import AbonoClienteCreate


valid = AbonoClienteCreate(
    cuenta_id=1,
    monto=Decimal("12.50"),
    metodo_pago="Transferencia",
    referencia="TRX-123",
)
assert valid.monto == Decimal("12.50")

for invalid in (
    {"cuenta_id": 0, "monto": "1.00", "metodo_pago": "Efectivo"},
    {"cuenta_id": 1, "monto": "0", "metodo_pago": "Efectivo"},
    {"cuenta_id": 1, "monto": "1.001", "metodo_pago": "Efectivo"},
    {"cuenta_id": 1, "monto": "1.00", "metodo_pago": "Crédito"},
):
    try:
        AbonoClienteCreate(**invalid)
    except ValidationError:
        continue
    raise AssertionError(f"El abono inválido fue aceptado: {invalid}")

print("Contrato de abonos de crédito: OK")
