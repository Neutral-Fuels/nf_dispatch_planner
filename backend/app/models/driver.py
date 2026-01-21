"""Driver model and driver schedule."""

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DriverType(str, enum.Enum):
    """Driver employment type."""

    INTERNAL = "internal"
    THIRD_PARTY = "3pl"


class DriverStatus(str, enum.Enum):
    """Driver daily availability status."""

    WORKING = "working"
    OFF = "off"
    HOLIDAY = "holiday"
    FLOAT = "float"


class Driver(Base):
    """Driver model."""

    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    employee_id: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, nullable=True
    )
    driver_type: Mapped[DriverType] = mapped_column(
        Enum(DriverType), nullable=False, default=DriverType.INTERNAL
    )
    contact_phone: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )
    license_number: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    license_expiry: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    schedules: Mapped[list["DriverSchedule"]] = relationship(
        "DriverSchedule", back_populates="driver", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Driver {self.name} ({self.driver_type.value})>"


class DriverSchedule(Base):
    """Driver daily availability schedule."""

    __tablename__ = "driver_schedules"
    __table_args__ = (
        UniqueConstraint("driver_id", "schedule_date", name="uq_driver_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    driver_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False
    )
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[DriverStatus] = mapped_column(
        Enum(DriverStatus), nullable=False, default=DriverStatus.WORKING
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    driver: Mapped["Driver"] = relationship("Driver", back_populates="schedules")

    def __repr__(self) -> str:
        return f"<DriverSchedule {self.driver_id} on {self.schedule_date}: {self.status.value}>"
