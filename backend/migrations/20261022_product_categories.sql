BEGIN;

UPDATE marcas
SET categoria = CASE categoria
    WHEN 'Accesorios para el cabello / Papeleria personalizada' THEN 'Accesorios para el cabello'
    WHEN 'Accesorios varios' THEN 'ACCESORIOS VARIOS'
    WHEN 'Alimentos' THEN 'Comestibles'
    WHEN 'Bisutería' THEN 'JOYERIA'
    WHEN 'Calzado' THEN 'CALZADO DAMA'
    WHEN 'CUIDADO DE LA PIEL' THEN 'SKINCARE'
    WHEN 'Dulces, fiestas de cumpleaños' THEN 'Comestibles'
    WHEN 'Juguetes y ropa para niños' THEN 'ROPA DE NIÑOS'
    WHEN 'Maquillaje y skin care' THEN 'Make up y Skincare'
    WHEN 'Papelería creativa' THEN 'Papelería y accesorios'
    WHEN 'Perfumería' THEN 'Perfumeria'
    WHEN 'Ropa embarazada' THEN 'Ropa/Dama'
    WHEN 'Ropa interior' THEN 'Ropa Interior'
    WHEN 'Ropa para dama' THEN 'Ropa/Dama'
    WHEN 'ROPA PARA MUJER' THEN 'Ropa/Dama'
    WHEN 'Ropa variada de dama' THEN 'Ropa/Dama'
    WHEN 'Ropa y accesorios para mascotas' THEN 'Accesorios para mascotas'
    WHEN 'Ropa y accesorios para vestir.' THEN 'ROPA VARIADA'
    WHEN 'Ropa, Bolsos para dama, cuidado capilar' THEN 'Ropa/Dama'
    WHEN 'Tecnología y accesorios Geek' THEN 'Tecnologia y Hogar'
    WHEN 'Tienda de accesorios, belleza, artículos para decoración y novedades.' THEN 'ACCESORIOS VARIOS'
    WHEN 'Hogar & Deco' THEN 'Tecnologia y Hogar'
    WHEN 'Moda Sostenible' THEN 'ROPA VARIADA'
    WHEN 'Cosmética Orgánica' THEN 'Make up y Skincare'
    WHEN 'Joyería' THEN 'JOYERIA'
    WHEN 'Textil Artesanal' THEN 'ROPA VARIADA'
    WHEN 'Marroquinería' THEN 'ACCESORIOS VARIOS'
    WHEN 'Papelería & Cerámica' THEN 'Papelería y accesorios'
    ELSE 'ROPA VARIADA'
END
WHERE categoria IS NULL OR categoria NOT IN (
    'ACCESORIOS', 'Accesorios para el cabello', 'Accesorios para mascotas',
    'ACCESORIOS VARIOS', 'Articulos para bebe', 'CALZADO DAMA', 'Comestibles',
    'JOYERIA', 'Make up y Skincare', 'Papelería y accesorios', 'Perfumeria',
    'ROPA DE NIÑOS', 'Ropa Interior', 'Ropa/Caballero', 'Ropa/Dama', 'SKINCARE',
    'Tecnologia y Hogar', 'ARTICULOS PARA DIABETICOS', 'ROPA VARIADA'
);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria varchar(100);
UPDATE productos p
SET categoria = COALESCE(m.categoria, 'ROPA VARIADA')
FROM marcas m
WHERE p.marca_id = m.id AND p.categoria IS NULL;
UPDATE productos SET categoria = 'ROPA VARIADA' WHERE categoria IS NULL;
ALTER TABLE productos ALTER COLUMN categoria SET DEFAULT 'ROPA VARIADA';
ALTER TABLE productos ALTER COLUMN categoria SET NOT NULL;

COMMIT;
