BEGIN;

ALTER TABLE marcas ADD CONSTRAINT marcas_categoria_check CHECK (categoria IN (
    'ACCESORIOS', 'Accesorios para el cabello', 'Accesorios para mascotas',
    'ACCESORIOS VARIOS', 'Articulos para bebe', 'CALZADO DAMA', 'Comestibles',
    'JOYERIA', 'Make up y Skincare', 'Papelería y accesorios', 'Perfumeria',
    'ROPA DE NIÑOS', 'Ropa Interior', 'Ropa/Caballero', 'Ropa/Dama', 'SKINCARE',
    'Tecnologia y Hogar', 'ARTICULOS PARA DIABETICOS', 'ROPA VARIADA'
));

ALTER TABLE productos ADD CONSTRAINT productos_categoria_check CHECK (categoria IN (
    'ACCESORIOS', 'Accesorios para el cabello', 'Accesorios para mascotas',
    'ACCESORIOS VARIOS', 'Articulos para bebe', 'CALZADO DAMA', 'Comestibles',
    'JOYERIA', 'Make up y Skincare', 'Papelería y accesorios', 'Perfumeria',
    'ROPA DE NIÑOS', 'Ropa Interior', 'Ropa/Caballero', 'Ropa/Dama', 'SKINCARE',
    'Tecnologia y Hogar', 'ARTICULOS PARA DIABETICOS', 'ROPA VARIADA'
));

COMMIT;
