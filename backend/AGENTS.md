# Backend notes

- Caja diaria uses the `America/Managua` business date. Keep its UTC boundary conversion and advisory lock shared by sale creation and closure so a sale cannot race a close.
- Monthly brand settlements use a fixed 20% store commission on product subtotals. The terminal's 5% POS charge is reported separately and does not reduce the brand payout.
- Only completed months can be settled. A settlement is unique per brand and month; a payment must retain its date and transfer reference.
- Brand rent uses a per-brand monthly configuration and explicit per-month generation. Each generated charge is unique per brand and month, charges the full monthly amount in the start month, snapshots the configured amount, and records partial payments with date and reference.
- The monthly report includes sales by day, brand, product, and payment method, plus comparison with the previous month. POS fees are allocated back to brands and products proportionally in cents.
- Settlement exports are selected by brand and month as a single XLSX statement. Use white headers and cells with gold accents, plus brand metadata, per-product/payment-method detail, totals, POS fee, store commission, net payout, and settlement status; use brand initials if its optional logo is unavailable. Inventory templates use the same white and gold palette.
- Sales history is exposed at `GET /api/v1/pos/ventas/historial`; keep its date filters in the Managua business timezone, and preserve brand, payment-method, customer/product search, pagination, and sale-item detail.
- Client records use `nombre_cliente`, `telefono`, `correo`, and optional `fecha_nacimiento`. POS sales must use the selected client ID; when none is selected, use the shared `Consumidor Final` customer because `ventas.cliente_id` is required.
- Receipt imports can regenerate a printable QR PDF at `GET /api/v1/recepcion/{ingreso_id}/qr-pdf`; generate from products attached to that import and preserve their existing QR values.
- Individual QR PNGs and printable PDF labels share a white rounded-card layout with centered QR, product name, SKU, and bold C$ price; preserve the existing QR payload.
- Inventory search accepts SKU, name, QR code, and description; keep the global header and inventory page searches wired to that endpoint.
