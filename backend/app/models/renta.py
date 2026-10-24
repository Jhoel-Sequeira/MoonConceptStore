from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint, text
from sqlalchemy.orm import relationship

from app.core.database import Base


class RentaConfig(Base):
    __tablename__ = "renta_config"
    __table_args__ = (CheckConstraint("dia_vencimiento BETWEEN 1 AND 31"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    marca_id = Column(Integer, ForeignKey("marcas.id"), nullable=False, unique=True)
    monto_mensual = Column(Numeric(12, 2), nullable=False)
    dia_vencimiento = Column(Integer, nullable=False, default=1, server_default=text("1"))
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date)
    activa = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    marca = relationship("Marca")


class Renta(Base):
    __tablename__ = "renta"
    __table_args__ = (UniqueConstraint("marca_id", "periodo", name="renta_marca_periodo_key"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    marca_id = Column(Integer, ForeignKey("marcas.id"), nullable=False)
    periodo = Column(Date, nullable=True)
    fecha_vencimiento = Column(Date, nullable=True)
    config_id = Column(Integer, ForeignKey("renta_config.id", ondelete="SET NULL"), nullable=True)
    fecha_pago = Column(DateTime, nullable=True)
    monto = Column(Numeric(12, 2), nullable=True)
    marca = relationship("Marca")
    pagos = relationship("RentaPago", back_populates="renta", cascade="all, delete-orphan")


class RentaPago(Base):
    __tablename__ = "renta_pago"

    pago_id = Column(Integer, primary_key=True, autoincrement=True)
    renta_id = Column(Integer, ForeignKey("renta.id"), nullable=False)
    monto_pagado = Column(Numeric(12, 2), nullable=False)
    fecha_pago = Column(DateTime, nullable=False)
    referencia_pago = Column(Text, nullable=False)
    comentario = Column(Text)
    renta = relationship("Renta", back_populates="pagos")
