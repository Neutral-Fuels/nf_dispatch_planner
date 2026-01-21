"""Trip Group models for weekly driver assignments."""

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.driver import Driver
    from app.models.schedule import WeeklyTemplate
    from app.models.user import User


# Association table for trip groups and templates (many-to-many)
trip_group_templates = Table(
    "trip_group_templates",
    Base.metadata,
    Column(
        "trip_group_id",
        Integer,
        ForeignKey("trip_groups.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "template_id",
        Integer,
        ForeignKey("weekly_templates.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class TripGroup(Base):
    """Group of weekly templates that form a route/shift."""

    __tablename__ = "trip_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    templates: Mapped[list["WeeklyTemplate"]] = relationship(
        "WeeklyTemplate",
        secondary=trip_group_templates,
        lazy="selectin",
    )
    assignments: Mapped[list["WeeklyDriverAssignment"]] = relationship(
        "WeeklyDriverAssignment",
        back_populates="trip_group",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<TripGroup {self.name}>"


class WeeklyDriverAssignment(Base):
    """Driver assigned to a trip group for a week."""

    __tablename__ = "weekly_driver_assignments"
    __table_args__ = (
        # One driver per group per week
        UniqueConstraint("trip_group_id", "week_start_date", name="unique_group_week"),
        # One group per driver per week
        UniqueConstraint("driver_id", "week_start_date", name="unique_driver_week"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trip_groups.id", ondelete="CASCADE"), nullable=False
    )
    driver_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False
    )
    week_start_date: Mapped[date] = mapped_column(
        Date, nullable=False, index=True
    )  # The Saturday starting the week
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    assigned_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    trip_group: Mapped["TripGroup"] = relationship(
        "TripGroup", back_populates="assignments"
    )
    driver: Mapped["Driver"] = relationship("Driver", lazy="selectin")
    assigned_by_user: Mapped[Optional["User"]] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<WeeklyDriverAssignment group={self.trip_group_id} driver={self.driver_id} week={self.week_start_date}>"
