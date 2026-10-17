from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, text

from app.core.database import Base


class Ingreso(Base):
    __tablename__ = "ingresos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    marca_id = Column(Integer, ForeignKey("marcas.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tipo_carga = Column(String(100), nullable=False)
    observaciones = Column(Text, nullable=True)
    estado_id = Column(Integer, ForeignKey("estados.id"), nullable=False)
    fecha_ingreso = Column(DateTime, nullable=True, server_default=text("CURRENT_TIMESTAMP"))


class IngresoDetalle(Base):
    __tablename__ = "ingreso_detalles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ingreso_id = Column(Integer, ForeignKey("ingresos.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_ingreso = Column(Numeric(12, 2), nullable=True)
