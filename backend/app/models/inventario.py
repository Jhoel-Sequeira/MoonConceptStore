from sqlalchemy import BigInteger, Column, Integer, String, Text, Numeric, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    marca_id = Column(Integer, ForeignKey("marcas.id"), nullable=False)
    categoria = Column(String(100), nullable=False, server_default=text("'ROPA VARIADA'"))
    detalles_rubro = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    codigo_qr = Column(String(255), nullable=False)
    sku = Column(String(100), nullable=True, unique=True, index=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    precio = Column(Numeric(12, 2), nullable=False, default=0.0)
    costo_nio = Column("costo_usd", Numeric(14, 6), nullable=True)
    tamano = Column(Text, nullable=True)
    stock_inicial = Column(Integer, nullable=False, default=0, server_default=text("0"))
    stock_critico = Column(Integer, nullable=False, default=5, server_default=text("5"))
    imagen_url = Column(Text, nullable=True)
    imagenes = Column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    estado_id = Column(Integer, nullable=False, default=1)

    marca = relationship("Marca", backref="productos")

class Kardex(Base):
    __tablename__ = "kardex"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    usuario_id = Column(Integer, nullable=False)
    tipo_movimiento = Column(String(100), nullable=False) # 'INGRESO', 'VENTA', 'BAJA', 'AJUSTE'
    cantidad = Column(Integer, nullable=False)
    referencia_id = Column(Integer, nullable=True)
    motivo = Column(Text, nullable=True)
    fecha = Column(DateTime, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP"))

    producto = relationship("Producto", backref="movimientos_kardex")
