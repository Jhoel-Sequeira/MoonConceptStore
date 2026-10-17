import urllib.request
import json

base_url = "http://localhost:8000/api/v1/marcas"

# Obtener primera marca existente
req = urllib.request.Request(f"{base_url}/")
res = urllib.request.urlopen(req)
marcas = json.loads(res.read().decode("utf-8"))
assert len(marcas) > 0, "No hay marcas"
first_id = marcas[0]["id"]
print("Probando con marca ID:", first_id, marcas[0]["nombre_marca"])

# 1. Probar descarga de Ficha de Entrega en Excel
url_excel = f"{base_url}/{first_id}/ficha-entrega"
req_excel = urllib.request.Request(url_excel)
res_excel = urllib.request.urlopen(req_excel)
content = res_excel.read()
print("Excel status:", res_excel.status, "Bytes recibidos:", len(content), "Content-Type:", res_excel.headers.get("Content-Type"))
assert len(content) > 1000, "Archivo Excel demasiado pequeño"

# 2. Probar subida de logo con multipart/form-data
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="test_logo.png"\r\n'
    f"Content-Type: image/png\r\n\r\n"
).encode("utf-8") + b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82" + f"\r\n--{boundary}--\r\n".encode("utf-8")

req_logo = urllib.request.Request(
    f"{base_url}/{first_id}/logo",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST"
)
res_logo = urllib.request.urlopen(req_logo)
brand_updated = json.loads(res_logo.read().decode("utf-8"))
print("Logo subido status:", res_logo.status, "Ruta logo guardada en BD:", brand_updated.get("logo"))
assert brand_updated.get("logo", "").startswith("/uploads/logos/"), "La ruta del logo no es correcta"

print("TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE!")
