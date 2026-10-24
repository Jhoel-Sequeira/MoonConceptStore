from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional
import io
import logging
import os
import posixpath
from urllib.parse import urlparse
import zipfile
import xml.etree.ElementTree as ET
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.drawing.image import Image as OpenpyxlImage
from PIL import Image as PILImage, ImageDraw, ImageFont
from app.models.marcas import Marca, Cuenta
from app.models.inventario import Kardex, Producto
from app.models.ingresos import Ingreso, IngresoDetalle
from app.schemas.marcas import MarcaCreate, MarcaUpdate
from app.core.storage import delete_image, download_image, upload_image
from app.core.categories import CATEGORY_FIELDS, normalize_category, validate_category_details

DELIVERY_TEMPLATE_VERSION = 6
DELIVERY_BASE_HEADERS = (
    "#", "SKU / CÓDIGO *", "NOMBRE * SI ES NUEVO", "DESCRIPCIÓN",
    "PRECIO VENTA C$ * SI ES NUEVO", "CANTIDAD RECIBIDA *", "URL / IMAGEN",
)
logger = logging.getLogger(__name__)


def _extract_in_cell_images(file_bytes: bytes, sheet_name: str, row_start: int, row_end: int) -> dict:
    """Read Excel's OOXML rich-data images, which openpyxl exposes as #VALUE! cells."""
    main_ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    office_rel_ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    package_rel_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
    rich_ns = "http://schemas.microsoft.com/office/spreadsheetml/2017/richdata"
    rich_rel_ns = "http://schemas.microsoft.com/office/spreadsheetml/2022/richvaluerel"
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            names = set(archive.namelist())
            required = {"xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/metadata.xml",
                        "xl/richData/rdrichvalue.xml", "xl/richData/richValueRel.xml",
                        "xl/richData/_rels/richValueRel.xml.rels"}
            if not required.issubset(names):
                return {}

            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            workbook_rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            relation_targets = {rel.get("Id"): rel.get("Target") for rel in workbook_rels}
            sheet = next(item for item in workbook.find(f"{{{main_ns}}}sheets")
                         if item.get("name") == sheet_name)
            target = relation_targets[sheet.get(f"{{{office_rel_ns}}}id")]
            sheet_path = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join("xl", target))
            sheet_xml = ET.fromstring(archive.read(sheet_path))
            row_vm = {}
            for cell in sheet_xml.iter(f"{{{main_ns}}}c"):
                coordinate = cell.get("r", "")
                if coordinate.startswith("G") and coordinate[1:].isdigit():
                    row_num = int(coordinate[1:])
                    if row_start <= row_num <= row_end and cell.get("vm"):
                        row_vm[row_num] = int(cell.get("vm")) - 1

            metadata = ET.fromstring(archive.read("xl/metadata.xml"))
            value_metadata = metadata.find(f"{{{main_ns}}}valueMetadata")
            future_metadata = next(item for item in metadata.findall(f"{{{main_ns}}}futureMetadata")
                                   if item.get("name") == "XLRICHVALUE")
            value_entries = list(value_metadata) if value_metadata is not None else []
            future_entries = list(future_metadata)
            rich_values = ET.fromstring(archive.read("xl/richData/rdrichvalue.xml"))
            rich_entries = list(rich_values)
            rich_value_rels = ET.fromstring(archive.read("xl/richData/richValueRel.xml"))
            rel_ids = [item.get(f"{{{office_rel_ns}}}id") for item in rich_value_rels.findall(f"{{{rich_rel_ns}}}rel")]
            image_rels = ET.fromstring(archive.read("xl/richData/_rels/richValueRel.xml.rels"))
            image_targets = {rel.get("Id"): rel.get("Target") for rel in image_rels.findall(f"{{{package_rel_ns}}}Relationship")}

            images = {}
            for row_num, vm_index in row_vm.items():
                if not 0 <= vm_index < len(value_entries):
                    continue
                rc = next((item for item in value_entries[vm_index] if item.tag.endswith("}rc")), None)
                if rc is None:
                    continue
                future_index = int(rc.get("v", "-1"))
                if not 0 <= future_index < len(future_entries):
                    continue
                rvb = next((node for node in future_entries[future_index].iter() if node.tag.endswith("}rvb")), None)
                if rvb is None:
                    continue
                rich_index = int(rvb.get("i", "-1"))
                if not 0 <= rich_index < len(rich_entries):
                    continue
                values = [node.text for node in rich_entries[rich_index].findall(f"{{{rich_ns}}}v")]
                if not values:
                    continue
                rel_index = int(values[0])
                if not 0 <= rel_index < len(rel_ids):
                    continue
                image_target = image_targets.get(rel_ids[rel_index], "")
                image_path = posixpath.normpath(posixpath.join("xl/richData", image_target))
                if image_path.startswith("xl/media/") and image_path in names:
                    images[row_num] = archive.read(image_path)
            return images
    except (KeyError, StopIteration, ValueError, ET.ParseError, zipfile.BadZipFile):
        return {}

class MarcasService:
    @staticmethod
    def get_all(db: Session) -> List[dict]:
        marcas = db.query(Marca).order_by(Marca.id.desc()).all()
        if not marcas:
            return []
        cuentas_por_marca = {}
        for cuenta in db.query(Cuenta).filter(Cuenta.marca_id.in_([m.id for m in marcas])).all():
            cuentas_por_marca.setdefault(cuenta.marca_id, cuenta)
        sku_counts = dict(db.execute(text(
            "SELECT marca_id, COUNT(*) FROM productos GROUP BY marca_id"
        )).all())
        sales_by_brand = dict(db.execute(text("""
            SELECT p.marca_id, COALESCE(SUM(vd.subtotal), 0)
            FROM venta_detalles vd
            JOIN productos p ON vd.producto_id = p.id
            JOIN ventas v ON vd.venta_id = v.id
            WHERE v.fecha_venta >= date_trunc('month', CURRENT_DATE)
              AND v.fecha_venta < date_trunc('month', CURRENT_DATE) + interval '1 month'
            GROUP BY p.marca_id
        """)).all())

        results = []
        for m in marcas:
            cuenta = cuentas_por_marca.get(m.id)
            banco = cuenta.banco if cuenta else None
            no_cuenta = cuenta.no_cuenta if cuenta else None
            sku_count = sku_counts.get(m.id, 0)
            sales_sum = sales_by_brand.get(m.id, 0.0)

            results.append({
                "id": m.id,
                "nombre_marca": m.nombre_marca,
                "cedula": m.cedula or "",
                "codigo": m.codigo or "",
                "categoria": m.categoria or "",
                "razon_social": m.razon_social or "",
                "ciudad_pais": m.ciudad_pais or "",
                "redes_sociales": m.redes_sociales or "",
                "nombre_representante": m.nombre_representante or "",
                "cargo": m.cargo or "",
                "contacto_nombre": m.contacto_nombre or "",
                "telefono": m.telefono or "",
                "email": m.email or "",
                "tiempo_estancia": m.tiempo_estancia or 6,
                "fecha_ingreso": m.fecha_ingreso.isoformat() if m.fecha_ingreso else None,
                "catalogo": m.catalogo or "",
                "estado_id": m.estado_id,
                "logo": m.logo or "",
                "banco": banco,
                "no_cuenta": no_cuenta,
                "activeSkus": f"{sku_count} SKUs" if m.estado_id == 2 else f"{sku_count} SKUs (En pausa)",
                "monthSales": float(sales_sum)
            })
        return results

    @staticmethod
    def get_by_id(db: Session, marca_id: int) -> Optional[dict]:
        m = db.query(Marca).filter(Marca.id == marca_id).first()
        if not m:
            return None
        cuenta = db.query(Cuenta).filter(Cuenta.marca_id == m.id).first()
        banco = cuenta.banco if cuenta else None
        no_cuenta = cuenta.no_cuenta if cuenta else None

        sku_count = db.execute(
            text("SELECT COUNT(*) FROM productos WHERE marca_id = :marca_id"),
            {"marca_id": m.id}
        ).scalar() or 0

        sales_sum = db.execute(
            text("""
                SELECT COALESCE(SUM(vd.subtotal), 0)
                FROM venta_detalles vd
                JOIN productos p ON vd.producto_id = p.id
                JOIN ventas v ON vd.venta_id = v.id
                WHERE p.marca_id = :marca_id
                AND v.fecha_venta >= date_trunc('month', CURRENT_DATE)
                AND v.fecha_venta < date_trunc('month', CURRENT_DATE) + interval '1 month'
            """),
            {"marca_id": m.id}
        ).scalar() or 0.0

        return {
            "id": m.id,
            "nombre_marca": m.nombre_marca,
            "cedula": m.cedula or "",
            "codigo": m.codigo or "",
            "categoria": m.categoria or "",
            "razon_social": m.razon_social or "",
            "ciudad_pais": m.ciudad_pais or "",
            "redes_sociales": m.redes_sociales or "",
            "nombre_representante": m.nombre_representante or "",
            "cargo": m.cargo or "",
            "contacto_nombre": m.contacto_nombre or "",
            "telefono": m.telefono or "",
            "email": m.email or "",
            "tiempo_estancia": m.tiempo_estancia or 6,
            "fecha_ingreso": m.fecha_ingreso.isoformat() if m.fecha_ingreso else None,
            "catalogo": m.catalogo or "",
            "estado_id": m.estado_id,
            "logo": m.logo or "",
            "banco": banco,
            "no_cuenta": no_cuenta,
            "activeSkus": f"{sku_count} SKUs",
            "monthSales": float(sales_sum)
        }

    @staticmethod
    def create(db: Session, marca_in: MarcaCreate) -> dict:
        marca = Marca(
            nombre_marca=marca_in.nombre_marca,
            cedula=marca_in.cedula,
            codigo=marca_in.codigo or (marca_in.nombre_marca[:3].upper() if marca_in.nombre_marca else "MC"),
            categoria=normalize_category(marca_in.categoria),
            razon_social=marca_in.razon_social,
            ciudad_pais=marca_in.ciudad_pais,
            redes_sociales=marca_in.redes_sociales,
            nombre_representante=marca_in.nombre_representante,
            cargo=marca_in.cargo,
            contacto_nombre=marca_in.contacto_nombre,
            telefono=marca_in.telefono,
            email=marca_in.email,
            tiempo_estancia=marca_in.tiempo_estancia,
            fecha_ingreso=marca_in.fecha_ingreso or datetime.utcnow(),
            catalogo=marca_in.catalogo,
            estado_id=marca_in.estado_id,
            logo=marca_in.logo,
            fecha_registro=datetime.utcnow()
        )
        db.add(marca)
        db.commit()
        db.refresh(marca)

        # Crear cuenta bancaria si fue provista
        if marca_in.banco or marca_in.no_cuenta:
            cuenta = Cuenta(
                marca_id=marca.id,
                banco=marca_in.banco,
                no_cuenta=marca_in.no_cuenta
            )
            db.add(cuenta)
            db.commit()
            db.refresh(cuenta)
            marca.cuentas = cuenta.id
            db.commit()

        return MarcasService.get_by_id(db, marca.id)

    @staticmethod
    def update(db: Session, marca_id: int, marca_in: MarcaUpdate) -> Optional[dict]:
        marca = db.query(Marca).filter(Marca.id == marca_id).first()
        if not marca:
            return None

        update_data = marca_in.dict(exclude_unset=True)
        category_changed = "categoria" in update_data
        if category_changed:
            update_data["categoria"] = normalize_category(update_data["categoria"])
        banco = update_data.pop("banco", None)
        no_cuenta = update_data.pop("no_cuenta", None)

        for key, value in update_data.items():
            setattr(marca, key, value)

        if category_changed:
            db.query(Producto).filter(Producto.marca_id == marca.id).update(
                {Producto.categoria: marca.categoria, Producto.detalles_rubro: {}}, synchronize_session=False
            )

        db.commit()

        # Actualizar cuenta bancaria
        if banco is not None or no_cuenta is not None:
            cuenta = db.query(Cuenta).filter(Cuenta.marca_id == marca.id).first()
            if cuenta:
                if banco is not None:
                    cuenta.banco = banco
                if no_cuenta is not None:
                    cuenta.no_cuenta = no_cuenta
            else:
                cuenta = Cuenta(
                    marca_id=marca.id,
                    banco=banco or "",
                    no_cuenta=no_cuenta or ""
                )
                db.add(cuenta)
                db.flush()
                marca.cuentas = cuenta.id
            db.commit()

        return MarcasService.get_by_id(db, marca.id)

    @staticmethod
    def update_logo(db: Session, marca_id: int, logo_url: str) -> Optional[dict]:
        marca = db.query(Marca).filter(Marca.id == marca_id).first()
        if not marca:
            return None
        marca.logo = logo_url
        db.commit()
        return MarcasService.get_by_id(db, marca.id)

    @staticmethod
    def generate_delivery_sheet(db: Session, marca_id: int):
        marca = db.query(Marca).filter(Marca.id == marca_id).first()
        if not marca:
            return None, None

        category = normalize_category(marca.categoria)
        category_fields = CATEGORY_FIELDS.get(category, ())
        headers = [*DELIVERY_BASE_HEADERS, *(label.upper() for _, label in category_fields)]
        category_start_col = len(DELIVERY_BASE_HEADERS) + 1
        last_col = len(headers)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Plantilla_Inventario"
        ws.sheet_view.showGridLines = False
        ws.freeze_panes = "A11"

        # Paleta de la tienda: rosa, blush, dorado y blanco.
        rose = "E9B7C3"
        pink = "F7D1D6"
        blush = "F3E2D9"
        gold = "C9A46D"
        white = "FFFFFF"
        ink = "493A35"
        muted = "786963"
        line = "E8D8D1"
        zebra = "FFFAF8"
        input_fill = "FFF3F4"
        gold_light = "F8F0E4"
        border = Border(*(Side(style="thin", color=line) for _ in range(4)))
        widths = {"A": 7, "B": 20, "C": 32, "D": 38, "E": 22, "F": 20, "G": 38}
        for col, width in widths.items():
            ws.column_dimensions[col].width = width
        for col in range(category_start_col, last_col + 1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 24

        ws.row_dimensions[1].height = 10
        ws.row_dimensions[2].height = 36
        ws.row_dimensions[3].height = 24
        ws.row_dimensions[4].height = 9
        ws.merge_cells("A2:A3")
        logo_inserted = False
        if getattr(marca, "logo", None):
            # ponytail: el logo es decorativo; si Storage falla, las iniciales mantienen descargable la ficha.
            try:
                logo_content = download_image(marca.logo)
            except Exception:
                logger.warning("No se pudo descargar el logo de la marca %s; se generará la ficha con sus iniciales", marca.id, exc_info=True)
                logo_content = None
            if logo_content is None:
                clean_logo = marca.logo.lstrip("/").replace("/", os.sep)
                if os.path.exists(clean_logo):
                    with open(clean_logo, "rb") as logo_file:
                        logo_content = logo_file.read()
            if logo_content:
                try:
                    with PILImage.open(io.BytesIO(logo_content)) as image:
                        w, h = image.size
                        ratio = min(82 / w, 50 / h, 1.0)
                    logo = OpenpyxlImage(io.BytesIO(logo_content))
                    logo.width, logo.height = int(w * ratio), int(h * ratio)
                    ws.add_image(logo, "A2")
                    logo_inserted = True
                except Exception:
                    pass
        if not logo_inserted:
            cell = ws["A2"]
            cell.value = (marca.codigo[:3] if marca.codigo else marca.nombre_marca[:3]).upper()
            cell.font = Font(name="Segoe UI", size=14, bold=True, color=white)
            cell.fill = PatternFill("solid", fgColor=gold)
            cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.merge_cells("B2:G2")
        ws["B2"] = f"PLANTILLA DE ENTREGA · {category.upper()}"
        ws["B2"].font = Font(name="Segoe UI", size=16, bold=True, color=ink)
        ws["B2"].alignment = Alignment(vertical="center")
        ws.merge_cells("B3:G3")
        ws["B3"] = f"Inventario para {marca.nombre_marca} · {marca.codigo or 'MARCA'}"
        ws["B3"].font = Font(name="Segoe UI", size=10, color=muted)
        ws["B3"].alignment = Alignment(vertical="center")
        ws.merge_cells("H2:J2")
        ws["H2"] = "IMPORTACIÓN PERSONALIZADA"
        ws["H2"].font = Font(name="Segoe UI", size=9, bold=True, color=ink)
        ws["H2"].fill = PatternFill("solid", fgColor=blush)
        ws["H2"].alignment = Alignment(horizontal="center", vertical="center")
        ws.merge_cells("H3:J3")
        ws["H3"] = f"Código {marca.codigo or '—'}  —  {datetime.now().strftime('%d/%m/%Y')}"
        ws["H3"].font = Font(name="Segoe UI", size=9, color=muted)
        ws["H3"].fill = PatternFill("solid", fgColor=gold_light)
        ws["H3"].alignment = Alignment(horizontal="center", vertical="center")

        ws.merge_cells("A5:J5")
        ws["A5"] = "DATOS DE LA MARCA"
        ws["A5"].font = Font(name="Segoe UI", size=10, bold=True, color=ink)
        ws["A5"].fill = PatternFill("solid", fgColor=pink)
        ws["A5"].alignment = Alignment(vertical="center")
        for col in range(1, 11):
            ws.cell(5, col).border = border
        details = [
            ("A6", "Marca"), ("B6", marca.nombre_marca), ("D6", "Código"), ("E6", marca.codigo or "—"),
            ("G6", "Categoría"), ("H6", marca.categoria or "General"),
            ("A7", "Representante"), ("B7", marca.nombre_representante or "—"),
            ("D7", "Correo"), ("E7", marca.email or "—"), ("G7", "Teléfono"), ("H7", marca.telefono or "—"),
        ]
        for address, value in details:
            c = ws[address]
            c.value = value
            c.border = border
            c.alignment = Alignment(vertical="center", wrap_text=True)
            c.font = Font(name="Segoe UI", size=9, bold=address[0] in "ADG", color=ink if address[0] in "ADG" else muted)
            if address[0] in "ADG":
                c.fill = PatternFill("solid", fgColor=gold_light)
        for row in (6, 7):
            ws.row_dimensions[row].height = 25
        ws.merge_cells("B6:C6")
        ws.merge_cells("E6:F6")
        ws.merge_cells("H6:J6")
        ws.merge_cells("B7:C7")
        ws.merge_cells("E7:F7")
        ws.merge_cells("H7:J7")

        ws.merge_cells(start_row=9, start_column=1, end_row=9, end_column=max(10, last_col))
        ws["A9"] = f"Completa SKU y cantidad recibida. Para productos nuevos también se necesita nombre y precio de venta. Campos de {category}: completa los que apliquen."
        ws["A9"].font = Font(name="Segoe UI", size=9, bold=True, color=ink)
        ws["A9"].fill = PatternFill("solid", fgColor=blush)
        ws["A9"].alignment = Alignment(vertical="center", wrap_text=True)
        ws.row_dimensions[9].height = 25

        for col, title in enumerate(headers, start=1):
            c = ws.cell(10, col, title)
            c.font = Font(name="Segoe UI", size=9, bold=True, color=white)
            c.fill = PatternFill("solid", fgColor=gold if col in (5, 6) else (pink if col >= category_start_col else rose))
            c.border = border
            c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c.comment = Comment({
                2: "Obligatorio y único por fila. Si ya existe en esta marca, la cantidad recibida se suma al stock. Si pertenece a otra marca, no se importa.",
                3: "Obligatorio para productos nuevos. Si el SKU ya existe en esta marca, se conservan los datos del producto.",
                4: "Detalle útil: material, color, modelo o contenido del paquete.",
                5: "Obligatorio para productos nuevos. Precio de venta en córdobas; admite decimales.",
                6: "Obligatorio. Cantidad física recibida, entero mayor que cero; se suma al stock actual.",
                7: "Opcional. Pega un URL público o inserta una imagen en esta fila; puedes usar ambos.",
            }.get(col, "Número consecutivo automático; no editar."), "Sistema")
            if col >= category_start_col:
                c.comment = Comment(f"Campo específico del rubro {category}. Opcional.", "Sistema")
        ws.row_dimensions[10].height = 38

        start_row, end_row = 11, 40
        for idx, r in enumerate(range(start_row, end_row + 1), start=1):
            ws.row_dimensions[r].height = 24
            ws.cell(r, 1, idx)
            for col in range(1, len(headers) + 1):
                c = ws.cell(r, col)
                c.border = border
                c.alignment = Alignment(vertical="center", wrap_text=col in (3, 4, 7) or col >= category_start_col)
                c.font = Font(name="Segoe UI", size=9, color=muted if col == 1 else ink)
                c.fill = PatternFill("solid", fgColor=(input_fill if col >= 2 else (white if idx % 2 else zebra)))
            ws.cell(r, 5).number_format = '"C$"#,##0.00'
            ws.cell(r, 6).number_format = "0"

        ws.conditional_formatting.add(
            f"B{start_row}:B{end_row}",
            FormulaRule(
                formula=[f'AND(B{start_row}<>"",COUNTIF($B${start_row}:$B${end_row},B{start_row})>1)'],
                fill=PatternFill("solid", fgColor=rose),
                font=Font(color="9F1239", bold=True),
            ),
        )

        ws.auto_filter.ref = f"A10:{openpyxl.utils.get_column_letter(len(headers))}{end_row}"
        dv_text = DataValidation(type="textLength", operator="lessThanOrEqual", formula1="100", allow_blank=True)
        dv_name = DataValidation(type="textLength", operator="lessThanOrEqual", formula1="255", allow_blank=True)
        dv_price = DataValidation(type="decimal", operator="greaterThan", formula1="0", allow_blank=True)
        dv_qty = DataValidation(type="whole", operator="greaterThan", formula1="0", allow_blank=False)
        for dv in (dv_text, dv_name, dv_price, dv_qty):
            dv.errorTitle = "Dato no válido"
            dv.error = "Revisa el valor y las instrucciones de la plantilla."
            dv.showErrorMessage = True
            ws.add_data_validation(dv)
        dv_text.add(f"B{start_row}:B{end_row}")
        dv_name.add(f"C{start_row}:C{end_row}")
        dv_price.add(f"E{start_row}:E{end_row}")
        dv_qty.add(f"F{start_row}:F{end_row}")
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.page_setup.orientation = "landscape"
        ws.print_title_rows = "1:10"

        guide = wb.create_sheet("Instrucciones_Carga")
        guide.sheet_view.showGridLines = False
        guide.column_dimensions["A"].width = 5
        guide.column_dimensions["B"].width = 29
        guide.column_dimensions["C"].width = 100
        guide.merge_cells("B2:C2")
        guide["B2"] = f"GUÍA DE CARGA — {category.upper()} · {marca.nombre_marca.upper()}"
        guide["B2"].font = Font(name="Segoe UI", size=15, bold=True, color=ink)
        guide["B2"].fill = PatternFill("solid", fgColor=pink)
        guide["B2"].alignment = Alignment(vertical="center")
        guide.row_dimensions[2].height = 34
        guide_data = [
            ("Objetivo", "Crea productos nuevos y registra las unidades recibidas. Si el SKU ya existe en esta marca, suma las unidades al stock y conserva sus datos."),
            ("SKU / Código *", "Escribe el SKU del producto. Si ya existe en esta marca, la cantidad se suma al stock; si pertenece a otra marca, la carga se rechaza."),
            ("Nombre *", "Obligatorio para productos nuevos. Para un SKU existente de esta marca puedes dejarlo vacío; los datos actuales del producto se conservan."),
            ("Descripción", "Agrega material, color, contenido del paquete, modelo u otra información que ayude a distinguirlo."),
            ("Precio venta en C$ *", "Obligatorio para productos nuevos. Para un producto existente puedes dejarlo vacío; el precio actual se conserva."),
            ("Cantidad recibida *", "Cantidad física entregada, como entero mayor que cero. En productos existentes se suma al stock actual."),
            ("URL / imagen", "Opcional. Pega un URL público en la columna o inserta una imagen en cualquier celda de la misma fila. Puedes proporcionar ambos."),
            ("Campos del rubro", ", ".join(label for _, label in category_fields) or "Sin campos específicos"),
            ("Antes de importar", "Completa una fila por SKU y cantidad recibida. No cambies el nombre de las hojas, encabezados ni estructura. Elimina filas de ejemplo vacías si agregaste datos fuera de las filas preparadas."),
            ("Resultado", "El sistema valida todo el archivo antes de guardar. Los SKU existentes de esta marca reciben más stock; los nuevos se crean. Si un SKU pertenece a otra marca o hay datos inválidos, no se aplica la carga."),
            ("Campos automáticos", "La marca, el identificador, el código QR y el estado activo los asigna el sistema. No hace falta escribirlos en esta plantilla."),
        ]
        for r, (label, desc) in enumerate(guide_data, start=4):
            guide.row_dimensions[r].height = 42
            a, b = guide.cell(r, 2, label), guide.cell(r, 3, desc)
            a.font = Font(name="Segoe UI", size=9, bold=True, color=ink)
            a.fill = PatternFill("solid", fgColor=blush if r % 2 == 0 else gold_light)
            b.font = Font(name="Segoe UI", size=9, color=ink)
            b.fill = PatternFill("solid", fgColor=white if r % 2 == 0 else zebra)
            for c in (a, b):
                c.border = border
                c.alignment = Alignment(vertical="center", wrap_text=True)

        meta = wb.create_sheet("_plantilla")
        for row, (key, value) in enumerate([
            ("marca_id", marca.id), ("marca_codigo", marca.codigo or ""), ("version", DELIVERY_TEMPLATE_VERSION),
            ("data_start", start_row), ("data_end", end_row), ("categoria", category),
        ], start=1):
            meta.cell(row, 1, key)
            meta.cell(row, 2, value)
        meta.sheet_state = "hidden"
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        category_slug = "_".join(category.replace("/", " ").split())
        filename = f"Plantilla_Inventario_{category_slug}_{marca.codigo or 'MARCA'}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        return output, filename

    @staticmethod
    def import_delivery_template(
        db: Session,
        marca_id: int,
        file_bytes: bytes,
        usuario_id: int,
        filename: Optional[str] = None,
    ) -> dict:
        marca = db.query(Marca).filter(Marca.id == marca_id).first()
        if not marca:
            raise ValueError("Marca no encontrada")
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        except Exception as exc:
            raise ValueError("El archivo no es una plantilla Excel válida (.xlsx)") from exc
        if "Plantilla_Inventario" not in wb.sheetnames or "_plantilla" not in wb.sheetnames:
            raise ValueError("La plantilla no corresponde al formato de importación de productos")
        meta = wb["_plantilla"]
        if meta["A1"].value != "marca_id" or str(meta["B1"].value) != str(marca.id) or meta["B3"].value != DELIVERY_TEMPLATE_VERSION:
            raise ValueError("La plantilla pertenece a otra marca o tiene una versión no compatible. Descarga una plantilla nueva.")

        ws = wb["Plantilla_Inventario"]
        data_start, data_end = meta["B4"].value, meta["B5"].value
        if not isinstance(data_start, int) or not isinstance(data_end, int) or data_start < 11 or data_end < data_start:
            raise ValueError("La plantilla no contiene un rango de productos válido")
        category = normalize_category(marca.categoria)
        category_fields = CATEGORY_FIELDS.get(category, ())
        category_start_col = len(DELIVERY_BASE_HEADERS) + 1
        if meta["B6"].value != category or [ws.cell(10, col).value for col in range(category_start_col, category_start_col + len(category_fields))] != [label.upper() for _, label in category_fields]:
            raise ValueError("El rubro de la marca cambió. Descarga una plantilla nueva.")
        rows, seen_skus = [], set()
        embedded_by_row = {}
        image_bytes_total = 0
        # ponytail: supports Excel OOXML rich-data in-cell images and standard floating images; other formats need a parser extension.
        image_types = {"JPEG": (".jpg", "image/jpeg"), "PNG": (".png", "image/png"), "WEBP": (".webp", "image/webp")}
        for row_num, content in _extract_in_cell_images(file_bytes, "Plantilla_Inventario", data_start, data_end).items():
            try:
                with PILImage.open(io.BytesIO(content)) as picture:
                    image_format = (picture.format or "").upper()
                    picture.verify()
            except Exception as exc:
                raise ValueError(f"La imagen incrustada de la fila {row_num} no es válida") from exc
            if image_format not in image_types:
                raise ValueError(f"La imagen de la fila {row_num} debe ser JPG, PNG o WEBP")
            if len(content) > 8 * 1024 * 1024:
                raise ValueError(f"La imagen de la fila {row_num} supera 8 MB")
            image_bytes_total += len(content)
            if image_bytes_total > 32 * 1024 * 1024:
                raise ValueError("Las imágenes incrustadas superan el límite total de 32 MB")
            extension, content_type = image_types[image_format]
            embedded_by_row[row_num] = (content, extension, content_type)
        for embedded in ws._images:
            row_index = getattr(getattr(getattr(embedded, "anchor", None), "_from", None), "row", None)
            if row_index is None or not data_start - 1 <= row_index <= data_end - 1:
                continue  # Ignora el logo de marca y las imágenes fuera de las filas de productos.
            row_num = row_index + 1
            # ponytail: asociar por fila admite una imagen por producto; varias requerirían una convención de galería.
            if row_num in embedded_by_row:
                raise ValueError(f"Solo se permite una imagen incrustada por producto (fila {row_num})")
            try:
                content = embedded._data()
                with PILImage.open(io.BytesIO(content)) as picture:
                    image_format = (picture.format or "").upper()
                    picture.verify()
            except Exception as exc:
                raise ValueError(f"La imagen incrustada de la fila {row_num} no es válida") from exc
            image_types = {"JPEG": (".jpg", "image/jpeg"), "PNG": (".png", "image/png"), "WEBP": (".webp", "image/webp")}
            if image_format not in image_types:
                raise ValueError(f"La imagen de la fila {row_num} debe ser JPG, PNG o WEBP")
            if len(content) > 8 * 1024 * 1024:
                raise ValueError(f"La imagen de la fila {row_num} supera 8 MB")
            image_bytes_total += len(content)
            if image_bytes_total > 32 * 1024 * 1024:
                raise ValueError("Las imágenes incrustadas superan el límite total de 32 MB")
            extension, content_type = image_types[image_format]
            embedded_by_row[row_num] = (content, extension, content_type)

        def parse_amount(value, label, row_num, required=False, allow_zero=True):
            if value is None or str(value).strip() == "":
                if required:
                    raise ValueError(f"La fila {row_num} necesita {label}")
                return None
            try:
                raw = str(value).strip().replace("C$", "").replace("$", "")
                if isinstance(value, str) and "," in raw:
                    if "." in raw and raw.rfind(",") > raw.rfind("."):
                        raw = raw.replace(".", "").replace(",", ".")
                    elif "." in raw:
                        raw = raw.replace(",", "")
                    else:
                        raw = raw.replace(",", ".")
                amount = Decimal(raw)
            except (InvalidOperation, ValueError) as exc:
                raise ValueError(f"{label} no válido en la fila {row_num}") from exc
            if not amount.is_finite() or amount < 0 or (not allow_zero and amount == 0):
                raise ValueError(f"{label} debe ser {'mayor que cero' if not allow_zero else 'cero o mayor'} (fila {row_num})")
            return amount

        for row_num, values in enumerate(ws.iter_rows(min_row=data_start, max_row=data_end, min_col=1, max_col=len(DELIVERY_BASE_HEADERS) + len(category_fields), values_only=True), start=data_start):
            # Ignorar solo filas completamente vacías en las columnas editables.
            editable = values[1:]
            if all(value is None or str(value).strip() == "" for value in editable) and row_num not in embedded_by_row:
                continue
            sku = str(values[1]).strip().upper() if values[1] is not None else ""
            name = str(values[2]).strip() if values[2] is not None else ""
            if not sku:
                raise ValueError(f"La fila {row_num} necesita el SKU del producto")
            if len(sku) > 100:
                raise ValueError(f"El SKU de la fila {row_num} supera los 100 caracteres")
            if len(name) > 255:
                raise ValueError(f"El nombre de la fila {row_num} supera los 255 caracteres")
            if sku in seen_skus:
                raise ValueError(f"El SKU {sku} está repetido en la plantilla (fila {row_num})")
            seen_skus.add(sku)

            price = parse_amount(values[4], "precio de venta", row_num, required=False, allow_zero=False)
            quantity_decimal = parse_amount(values[5], "cantidad recibida", row_num, required=True, allow_zero=False)
            if quantity_decimal != quantity_decimal.to_integral_value() or quantity_decimal > 2147483647:
                raise ValueError(f"La cantidad recibida de la fila {row_num} debe ser un entero positivo dentro del rango permitido")
            if price is not None and price > Decimal("9999999999.99"):
                raise ValueError(f"El precio de la fila {row_num} excede el máximo admitido")
            image_url = str(values[6]).strip() if values[6] is not None and str(values[6]).strip() else None
            if image_url and row_num in embedded_by_row and image_url.startswith("#"):
                image_url = None  # Excel reports #VALUE! for rich-data images when openpyxl reads the cell.
            if image_url and len(image_url) > 2000:
                raise ValueError(f"La URL de imagen de la fila {row_num} es demasiado larga")
            if image_url:
                parsed_image_url = urlparse(image_url)
                if parsed_image_url.scheme not in ("http", "https") or not parsed_image_url.netloc:
                    raise ValueError(f"La URL de imagen de la fila {row_num} debe comenzar con http:// o https://")
            details = validate_category_details(category, {
                field: str(values[len(DELIVERY_BASE_HEADERS) + index]).strip()
                for index, (field, _) in enumerate(category_fields)
                if values[len(DELIVERY_BASE_HEADERS) + index] is not None and str(values[len(DELIVERY_BASE_HEADERS) + index]).strip()
            })
            size_value = details.pop("talla", None)
            if size_value is None:
                size_value = details.pop("tamano", None)
            rows.append({
                "row_num": row_num,
                "sku": sku,
                "nombre": name,
                "descripcion": str(values[3]).strip() if values[3] is not None and str(values[3]).strip() else None,
                "tamano": size_value,
                "precio": price,
                "stock_inicial": int(quantity_decimal),
                "imagen_url": image_url,
                "imagen_incrustada": row_num in embedded_by_row,
                "detalles_rubro": details,
            })
        if not rows:
            raise ValueError("No hay productos para importar")

        # Bloquear productos existentes evita que dos recepciones simultáneas
        # pierdan unidades al actualizar el kardex.
        existing_products = {
            (product.sku or "").upper(): product
            for product in db.query(Producto)
            .filter(func.upper(Producto.sku).in_([item["sku"] for item in rows]))
            .with_for_update()
            .all()
        }
        for item in rows:
            product = existing_products.get(item["sku"])
            if product and product.marca_id != marca_id:
                raise ValueError(
                    f"El SKU {item['sku']} pertenece a otra marca (fila {item['row_num']})."
                )
            if not product:
                if not item["nombre"]:
                    raise ValueError(f"La fila {item['row_num']} necesita el nombre para crear un producto nuevo")
                if item["precio"] is None:
                    raise ValueError(f"La fila {item['row_num']} necesita el precio para crear un producto nuevo")

        uploaded_image_urls = []
        try:
            ingreso = Ingreso(
                marca_id=marca_id,
                usuario_id=usuario_id,
                tipo_carga="IMPORTACION EXCEL",
                observaciones=filename or "Importación de plantilla de productos",
                estado_id=1,
                fecha_ingreso=datetime.utcnow(),
            )
            db.add(ingreso)
            db.flush()

            productos_procesados = []
            productos_creados = 0
            productos_actualizados = 0
            for item in rows:
                producto = existing_products.get(item["sku"])
                if producto:
                    productos_actualizados += 1
                else:
                    embedded_image_url = None
                    if item["imagen_incrustada"]:
                        content, extension, content_type = embedded_by_row[item["row_num"]]
                        embedded_image_url = upload_image(
                            f"moonconcept/productos/{marca_id}/{item['sku']}",
                            f"{item['sku']}{extension}", content, content_type,
                        )
                        uploaded_image_urls.append(embedded_image_url)
                    image_urls = list(dict.fromkeys(url for url in (item["imagen_url"], embedded_image_url) if url))
                    producto = Producto(
                        marca_id=marca_id,
                        categoria=category,
                        detalles_rubro=item["detalles_rubro"],
                        sku=item["sku"],
                        nombre=item["nombre"],
                        descripcion=item["descripcion"],
                        tamano=item["tamano"],
                        precio=item["precio"],
                        stock_inicial=0,
                        stock_critico=5,
                        imagen_url=item["imagen_url"] or embedded_image_url,
                        imagenes=image_urls,
                        estado_id=1,
                        codigo_qr=f"BHPOS-{item['sku']}",
                    )
                    db.add(producto)
                    productos_creados += 1
                productos_procesados.append((producto, item))

            db.flush()
            detalles, movimientos = [], []
            for producto, item in productos_procesados:
                cantidad = item["stock_inicial"]
                detalles.append(IngresoDetalle(
                    ingreso_id=ingreso.id,
                    producto_id=producto.id,
                    cantidad=cantidad,
                    precio_ingreso=None,
                ))
                movimientos.append(Kardex(
                    producto_id=producto.id,
                    usuario_id=usuario_id,
                    tipo_movimiento="INGRESO",
                    cantidad=cantidad,
                    referencia_id=ingreso.id,
                    motivo=f"Importación de productos desde {ingreso.observaciones}",
                ))
            db.add_all(detalles + movimientos)
            qr_pdf = MarcasService._generate_import_qr_pdf(productos_procesados)
            db.commit()
        except Exception:
            db.rollback()
            for image_url in uploaded_image_urls:
                delete_image(image_url)
            raise
        return {
            "ingreso_id": ingreso.id,
            "creados": productos_creados,
            "actualizados": productos_actualizados,
            "unidades": sum(item["stock_inicial"] for item in rows),
            "qr_pdf": qr_pdf,
            "qr_pdf_filename": f"QR_Productos_{marca.id}.pdf",
        }

    @staticmethod
    def _generate_import_qr_pdf(productos_procesados: list) -> bytes:
        import qrcode

        # ponytail: rasterizar una hoja carta con Pillow evita añadir una dependencia PDF.
        page_width, page_height = 1275, 1650  # Carta a 150 DPI
        columns, rows_per_page = 2, 4
        cell_width, cell_height = page_width // columns, page_height // rows_per_page
        font_paths = (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "C:/Windows/Fonts/arial.ttf",
        )
        try:
            font_path = next(path for path in font_paths if os.path.exists(path))
            title_font = ImageFont.truetype(font_path, 28)
            detail_font = ImageFont.truetype(font_path, 22)
            ascii_fallback = False
        except (OSError, StopIteration):
            title_font = detail_font = ImageFont.load_default()
            ascii_fallback = True

        pages = []
        for page_start in range(0, len(productos_procesados), columns * rows_per_page):
            page = PILImage.new("RGB", (page_width, page_height), "white")
            draw = ImageDraw.Draw(page)
            page_items = productos_procesados[page_start:page_start + columns * rows_per_page]
            for index, (producto, _) in enumerate(page_items):
                column, row = index % columns, index // columns
                left, top = column * cell_width, row * cell_height
                qr = qrcode.make(producto.codigo_qr or f"BHPOS-{producto.sku}").convert("RGB")
                qr.thumbnail((300, 300))
                qr_left = left + (cell_width - qr.width) // 2
                page.paste(qr, (qr_left, top + 20))
                center_x = left + cell_width // 2
                name = producto.nombre or "Producto"
                sku = f"SKU: {producto.sku}"
                if ascii_fallback:
                    import unicodedata
                    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
                    sku = unicodedata.normalize("NFKD", sku).encode("ascii", "ignore").decode("ascii")
                draw.text((center_x, top + 335), name, fill="black", font=title_font, anchor="mt")
                draw.text((center_x, top + 380), sku, fill="black", font=detail_font, anchor="mt")
                draw.rectangle((left + 12, top + 12, left + cell_width - 12, top + cell_height - 12), outline="#cccccc", width=2)
            pages.append(page)

        output = io.BytesIO()
        pages[0].save(output, format="PDF", save_all=True, append_images=pages[1:], resolution=150)
        return output.getvalue()

    @staticmethod
    def delete(db: Session, marca_id: int) -> bool:
        marca = db.query(Marca).filter(Marca.id == marca_id).first()
        if not marca:
            return False

        # Eliminar cuentas asociadas
        db.query(Cuenta).filter(Cuenta.marca_id == marca_id).delete()
        db.delete(marca)
        db.commit()
        return True
