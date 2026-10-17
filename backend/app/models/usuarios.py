from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, text

from app.core.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    usuario = Column(String(100), nullable=False, unique=True)
    password_hash = Column("pass", String(255), nullable=False)
    rol = Column(String(50), nullable=False)
    estado_id = Column(Integer, ForeignKey("estados.id"), nullable=False)
    creado_en = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
