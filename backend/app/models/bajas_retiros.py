from sqlalchemy import Column, Date, ForeignKey, Integer, Text, text

from app.core.database import Base


class Retiro(Base):
    __tablename__ = "retiros"

    # The existing Supabase schema does not define identity defaults for these IDs.
    id = Column(Integer, primary_key=True, autoincrement=False)
    marca_id = Column(Integer, ForeignKey("marcas.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    fecha_retiro = Column(Date, nullable=False, server_default=text("CURRENT_DATE"))
    motivo = Column(Text, nullable=False)
    estado_id = Column(Integer, ForeignKey("estados.id"), nullable=False)


class DetalleRetiro(Base):
    __tablename__ = "detalle_retiro"

    # The existing Supabase schema also requires the detail ID to be supplied.
    detalle_id = Column(Integer, primary_key=True, autoincrement=False)
    retiro_id = Column(Integer, ForeignKey("retiros.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cantidad = Column(Integer, nullable=False)
