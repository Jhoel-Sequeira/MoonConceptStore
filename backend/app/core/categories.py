PRODUCT_CATEGORIES = (
    "ACCESORIOS",
    "Accesorios para el cabello",
    "Accesorios para mascotas",
    "ACCESORIOS VARIOS",
    "Articulos para bebe",
    "CALZADO DAMA",
    "Comestibles",
    "JOYERIA",
    "Make up y Skincare",
    "Papelería y accesorios",
    "Perfumeria",
    "ROPA DE NIÑOS",
    "Ropa Interior",
    "Ropa/Caballero",
    "Ropa/Dama",
    "SKINCARE",
    "Tecnologia y Hogar",
    "ARTICULOS PARA DIABETICOS",
    "ROPA VARIADA",
)

CATEGORY_FIELDS = {
    "ACCESORIOS": (("tipo", "Tipo de accesorio"), ("material", "Material"), ("color", "Color"), ("medidas", "Medidas")),
    "Accesorios para el cabello": (("tipo", "Tipo de accesorio"), ("material", "Material"), ("color", "Color"), ("uso", "Uso")),
    "Accesorios para mascotas": (("mascota", "Tipo de mascota"), ("tipo", "Tipo de accesorio"), ("talla", "Talla"), ("material", "Material")),
    "ACCESORIOS VARIOS": (("tipo", "Tipo de accesorio"), ("material", "Material"), ("color", "Color"), ("medidas", "Medidas")),
    "Articulos para bebe": (("edad", "Edad recomendada"), ("talla", "Talla"), ("material", "Material"), ("color", "Color")),
    "CALZADO DAMA": (("talla", "Talla"), ("material", "Material"), ("color", "Color"), ("estilo", "Estilo")),
    "Comestibles": (("contenido", "Contenido neto"), ("unidad", "Unidad"), ("ingredientes", "Ingredientes"), ("vencimiento", "Fecha de vencimiento")),
    "JOYERIA": (("material", "Material"), ("piedra", "Piedra o detalle"), ("medida", "Medida"), ("acabado", "Acabado")),
    "Make up y Skincare": (("tipo", "Tipo de producto"), ("tono", "Tono"), ("contenido", "Contenido"), ("tipo_piel", "Tipo de piel")),
    "Papelería y accesorios": (("tipo", "Tipo de artículo"), ("material", "Material"), ("tamano", "Tamaño"), ("uso", "Uso")),
    "Perfumeria": (("aroma", "Aroma"), ("contenido", "Contenido"), ("concentracion", "Concentración"), ("presentacion", "Presentación")),
    "ROPA DE NIÑOS": (("talla", "Talla"), ("edad", "Edad recomendada"), ("material", "Material"), ("color", "Color")),
    "Ropa Interior": (("tipo_prenda", "Tipo de prenda"), ("talla", "Talla"), ("material", "Material"), ("color", "Color")),
    "Ropa/Caballero": (("tipo_prenda", "Tipo de prenda"), ("talla", "Talla"), ("material", "Material"), ("color", "Color")),
    "Ropa/Dama": (("tipo_prenda", "Tipo de prenda"), ("talla", "Talla"), ("material", "Material"), ("color", "Color")),
    "SKINCARE": (("tipo_piel", "Tipo de piel"), ("contenido", "Contenido"), ("ingredientes", "Ingredientes"), ("uso", "Uso")),
    "Tecnologia y Hogar": (("tipo", "Tipo de producto"), ("marca_fabricante", "Marca fabricante"), ("modelo", "Modelo"), ("garantia", "Garantía")),
    "ARTICULOS PARA DIABETICOS": (("tipo", "Tipo de artículo"), ("presentacion", "Presentación"), ("contenido", "Contenido"), ("compatibilidad", "Compatibilidad")),
    "ROPA VARIADA": (("tipo_prenda", "Tipo de prenda"), ("talla", "Talla"), ("material", "Material"), ("color", "Color")),
}


def normalize_category(category: str | None) -> str:
    value = (category or "").strip()
    match = next((item for item in PRODUCT_CATEGORIES if item.casefold() == value.casefold()), None)
    if match:
        return match

    # ponytail: map the old broad labels to the closest current rubro; revisit only if legacy data needs finer distinctions.
    legacy_categories = {
        "Hogar & Deco": "Tecnologia y Hogar",
        "Moda Sostenible": "ROPA VARIADA",
        "Cosmética Orgánica": "Make up y Skincare",
        "Joyería": "JOYERIA",
        "Textil Artesanal": "ROPA VARIADA",
        "Marroquinería": "ACCESORIOS VARIOS",
        "Papelería & Cerámica": "Papelería y accesorios",
    }
    return legacy_categories.get(value, "ROPA VARIADA")


def validate_category_details(category: str, details: dict[str, str] | None) -> dict[str, str]:
    fields = {key for key, _ in CATEGORY_FIELDS.get(category, ())}
    values = details or {}
    invalid = set(values) - fields
    if invalid:
        raise ValueError(f"Campos no válidos para el rubro {category}: {', '.join(sorted(invalid))}")
    cleaned = {}
    for key, value in values.items():
        value = value.strip()
        if len(value) > 2000:
            raise ValueError(f"El campo {key} no puede superar 2000 caracteres")
        if value:
            cleaned[key] = value
    return cleaned
