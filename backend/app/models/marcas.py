from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Estado(Base):
    __tablename__ = "estados"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    modulo = Column(String(100), nullable=False)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)

class Cuenta(Base):
    __tablename__ = "cuentas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    marca_id = Column(Integer, ForeignKey("marcas.id"), nullable=True)
    banco = Column(Text, nullable=True)
    no_cuenta = Column(Text, nullable=True)

    marca = relationship("Marca", back_populates="cuentas_bancarias")

class Marca(Base):
    __tablename__ = "marcas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre_marca = Column(String(255), nullable=False)
    cedula = Column(Text, nullable=True)
    contacto_nombre = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    categoria = Column(Text, nullable=False)
    ciudad_pais = Column(Text, nullable=True)
    razon_social = Column(Text, nullable=True)
    redes_sociales = Column(Text, nullable=True)
    cargo = Column(Text, nullable=True)
    nombre_representante = Column(Text, nullable=True)
    tiempo_estancia = Column(Float, nullable=True, default=6)
    fecha_ingreso = Column(DateTime, nullable=True, default=datetime.utcnow)
    catalogo = Column(Text, nullable=True)
    estado_id = Column(Integer, ForeignKey("estados.id"), nullable=False, default=1)
    cuentas = Column(Integer, nullable=True)
    fecha_registro = Column(DateTime, nullable=True, default=datetime.utcnow)
    codigo = Column(Text, nullable=True)
    logo = Column(Text, nullable=True)

    cuentas_bancarias = relationship("Cuenta", back_populates="marca", cascade="all, delete-orphan")
