import urllib.request
import json

base_url = "http://localhost:8000/api/v1/marcas"

# 1. Crear marca de prueba
new_brand = {
    "nombre_marca": "Marca Test XAMPP",
    "codigo": "TST",
    "categoria": "Hogar y Deco",
    "ciudad_pais": "Managua, Nicaragua",
    "nombre_representante": "Juan Perez",
    "cargo": "Director",
    "telefono": "+505 8888 8888",
    "email": "test@xampp.com",
    "banco": "BAC Credomatic",
    "no_cuenta": "999-000-111"
}

req = urllib.request.Request(
    f"{base_url}/",
    data=json.dumps(new_brand).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
res = urllib.request.urlopen(req)
created = json.loads(res.read().decode("utf-8"))
print("CREADO OK:", created["id"], created["nombre_marca"])

# 2. Actualizar
brand_id = created["id"]
update_data = {"nombre_marca": "Marca Test Actualizada"}
req_update = urllib.request.Request(
    f"{base_url}/{brand_id}",
    data=json.dumps(update_data).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="PUT"
)
res_update = urllib.request.urlopen(req_update)
updated = json.loads(res_update.read().decode("utf-8"))
print("ACTUALIZADO OK:", updated["nombre_marca"])

# 3. Eliminar
req_delete = urllib.request.Request(f"{base_url}/{brand_id}", method="DELETE")
res_del = urllib.request.urlopen(req_delete)
print("ELIMINADO OK:", res_del.status)
