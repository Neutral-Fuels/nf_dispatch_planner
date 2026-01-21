"""Tanker model with blend and emirate relationships."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.driver import Driver
    from app.models.reference import Emirate, FuelBlend


class DeliveryType(str, enum.Enum):
    """Tanker delivery capability type."""

    BULK = "bulk"
    MOBILE = "mobile"
    BOTH = "both"


class TankerStatus(str, enum.Enum):
    """Tanker operational status."""

    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    INACTIVE = "inactive"


# Many-to-many relationship tables
tanker_blends = Table(
    "tanker_blends",
    Base.metadata,
    Column(
        "tanker_id",
        Integer,
        ForeignKey("tankers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "fuel_blend_id",
        Integer,
        ForeignKey("fuel_blends.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

tanker_emirates = Table(
    "tanker_emirates",
    Base.metadata,
    Column(
        "tanker_id",
        Integer,
        ForeignKey("tankers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "emirate_id",
        Integer,
        ForeignKey("emirates.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Tanker(Base):
    """Tanker fleet model."""

    __tablename__ = "tankers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    registration: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    max_capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_type: Mapped[DeliveryType] = mapped_column(
        Enum(DeliveryType), nullable=False
    )
    status: Mapped[TankerStatus] = mapped_column(
        Enum(TankerStatus), default=TankerStatus.ACTIVE
    )
    is_3pl: Mapped[bool] = mapped_column(Boolean, default=False)
    default_driver_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    fuel_blends: Mapped[list["FuelBlend"]] = relationship(
        "FuelBlend", secondary=tanker_blends, lazy="selectin"
    )
    emirates: Mapped[list["Emirate"]] = relationship(
        "Emirate", secondary=tanker_emirates, lazy="selectin"
    )
    default_driver: Mapped[Optional["Driver"]] = relationship(
        "Driver", foreign_keys=[default_driver_id]
    )

    def __repr__(self) -> str:
        return f"<Tanker {self.name} ({self.max_capacity}L)>"

    def supports_blend(self, blend_id: int) -> bool:
        """Check if tanker supports a specific fuel blend."""
        return any(b.id == blend_id for b in self.fuel_blends)

    def covers_emirate(self, emirate_id: int) -> bool:
        """Check if tanker covers a specific emirate."""
        return any(e.id == emirate_id for e in self.emirates)

    def can_deliver_to_customer_type(self, customer_type: str) -> bool:
        """Check if tanker can deliver to customer type (bulk/mobile)."""
        if self.delivery_type == DeliveryType.BOTH:
            return True
        return self.delivery_type.value == customer_type
