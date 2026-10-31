"""Small contract check for customer registration and optional POS selection."""
from datetime import date

from app.schemas.clientes import ClienteCreate
from app.schemas.pos import VentaCreate, VentaItemCreate


def main() -> None:
    customer = ClienteCreate(fecha_nacimiento=date(1990, 5, 20), nombre_cliente="María López", telefono="+505 8888-1111", correo="maria@example.com")
    assert customer.nombre_cliente == "María López"
    assert customer.fecha_nacimiento == date(1990, 5, 20)

    sale_without_customer = VentaCreate(metodo_pago="Efectivo", items=[VentaItemCreate(producto_id=1, cantidad=1)])
    assert sale_without_customer.cliente_id is None

    sale_with_customer = VentaCreate(
        cliente_id=42,
        metodo_pago="Efectivo",
        items=[VentaItemCreate(producto_id=1, cantidad=1)],
    )
    assert sale_with_customer.cliente_id == 42
    print("Contrato de clientes y selección opcional del POS: OK")


if __name__ == "__main__":
    main()
