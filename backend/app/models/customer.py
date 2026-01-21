"""Customer model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.reference import Emirate, FuelBlend


class CustomerType(str, enum.Enum):
    """Customer delivery type."""

    BULK = "bulk"
    MOBILE = "mobile"


class Customer(Base):
    """Customer model."""

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    customer_type: Mapped[CustomerType] = mapped_column(
        Enum(CustomerType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    fuel_blend_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("fuel_blends.id"), nullable=True
    )
    estimated_volume: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    emirate_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("emirates.id"), nullable=True
    )
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    fuel_blend: Mapped[Optional["FuelBlend"]] = relationship(
        "FuelBlend", lazy="selectin"
    )
    emirate: Mapped[Optional["Emirate"]] = relationship("Emirate", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Customer {self.code}: {self.name}>"
