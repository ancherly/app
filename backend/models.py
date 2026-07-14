# models.py — Modelos SQLAlchemy que mapean las tablas de Supabase
import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Boolean, Float, Integer, DateTime, Date, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default='employee')
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Punch(Base):
    __tablename__ = 'punches'

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    check_in_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    check_in_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    check_in_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    check_out_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    check_out_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    check_out_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    check_out_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default='open')
    edited_by_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    edited_by: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GymSettings(Base):
    __tablename__ = 'gym_settings'

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=40.416775)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=-3.703790)
    radius_meters: Mapped[int] = mapped_column(Integer, default=100)
    timezone: Mapped[str] = mapped_column(String(100), default='Europe/Madrid')
