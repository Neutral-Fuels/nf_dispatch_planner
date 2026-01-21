"""Schedule models - Weekly Templates, Daily Schedules, and Trips."""

import enum
from datetime import date, datetime, time
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.driver import Driver
    from app.models.reference import FuelBlend
    from app.models.tanker import Tanker
    from app.models.user import User


class TripStatus(str, enum.Enum):
    """Trip assignment status."""

    SCHEDULED = "scheduled"
    UNASSIGNED = "unassigned"
    CONFLICT = "conflict"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class WeeklyTemplate(Base):
    """Recurring weekly schedule template."""

    __tablename__ = "weekly_templates"
    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="valid_day"),
        CheckConstraint("end_time > start_time", name="valid_time_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True
    )  # 0=Saturday, 6=Friday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    tanker_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tankers.id"), nullable=True
    )
    fuel_blend_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("fuel_blends.id"), nullable=True
    )
    volume: Mapped[int] = mapped_column(Integer, nullable=False)
    is_mobile_op: Mapped[bool] = mapped_column(Boolean, default=False)
    needs_return: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", lazy="selectin")
    tanker: Mapped[Optional["Tanker"]] = relationship("Tanker", lazy="selectin")
    fuel_blend: Mapped[Optional["FuelBlend"]] = relationship(
        "FuelBlend", lazy="selectin"
    )

    # Day name mapping (UAE week starts Saturday)
    DAY_NAMES = [
        "Saturday",
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
    ]

    @property
    def day_name(self) -> str:
        """Get human-readable day name."""
        return self.DAY_NAMES[self.day_of_week]

    def __repr__(self) -> str:
        return f"<WeeklyTemplate {self.customer_id} on {self.day_name} at {self.start_time}>"


class DailySchedule(Base):
    """Daily schedule container."""

    __tablename__ = "daily_schedules"
    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="valid_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_date: Mapped[date] = mapped_column(
        Date, nullable=False, unique=True, index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    trips: Mapped[list["Trip"]] = relationship(
        "Trip", back_populates="daily_schedule", cascade="all, delete-orphan"
    )
    created_by_user: Mapped[Optional["User"]] = relationship("User")

    def __repr__(self) -> str:
        return f"<DailySchedule {self.schedule_date}>"


class Trip(Base):
    """Individual delivery trip."""

    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="valid_trip_time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    daily_schedule_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("daily_schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("weekly_templates.id"), nullable=True
    )
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id"), nullable=False, index=True
    )
    tanker_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tankers.id"), nullable=True, index=True
    )
    driver_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("drivers.id"), nullable=True, index=True
    )
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    fuel_blend_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("fuel_blends.id"), nullable=True
    )
    volume: Mapped[int] = mapped_column(Integer, nullable=False)
    is_mobile_op: Mapped[bool] = mapped_column(Boolean, default=False)
    needs_return: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus, values_callable=lambda x: [e.value for e in x]),
        default=TripStatus.SCHEDULED,
        index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    daily_schedule: Mapped["DailySchedule"] = relationship(
        "DailySchedule", back_populates="trips"
    )
    template: Mapped[Optional["WeeklyTemplate"]] = relationship("WeeklyTemplate")
    customer: Mapped["Customer"] = relationship("Customer", lazy="selectin")
    tanker: Mapped[Optional["Tanker"]] = relationship("Tanker", lazy="selectin")
    driver: Mapped[Optional["Driver"]] = relationship("Driver", lazy="selectin")
    fuel_blend: Mapped[Optional["FuelBlend"]] = relationship(
        "FuelBlend", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Trip {self.customer_id} at {self.start_time}-{self.end_time}>"
