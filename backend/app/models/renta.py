from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Renta(Base):
    __tablename__ = "renta"

    id = Column(Integer, primary_key=True, autoincrement=True)
    marca_id = Column(Integer, ForeignKey("marcas.id"))
    fecha_pago = Column(DateTime)
    monto = Column(Float)
    marca = relationship("Marca")
    pagos = relationship("RentaPago", back_populates="renta", cascade="all, delete-orphan")


class RentaPago(Base):
    __tablename__ = "renta_pago"

    pago_id = Column(Integer, primary_key=True, autoincrement=True)
    renta_id = Column(Integer, ForeignKey("renta.id"))
    monto_pagado = Column(Float)
    fecha_pago = Column(DateTime)
    comentario = Column(Text)
    renta = relationship("Renta", back_populates="pagos")
