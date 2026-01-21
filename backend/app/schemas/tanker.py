"""Tanker schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.tanker import DeliveryType, TankerStatus
from app.schemas.reference import EmirateResponse, FuelBlendResponse


class TankerBase(BaseModel):
    """Base tanker schema."""

    name: str = Field(..., min_length=1, max_length=50)
    registration: Optional[str] = Field(None, max_length=50)
    max_capacity: int = Field(..., gt=0)
    delivery_type: DeliveryType
    is_3pl: bool = False
    notes: Optional[str] = None


class TankerCreate(TankerBase):
    """Tanker creation schema."""

    fuel_blend_ids: list[int] = Field(default_factory=list)
    emirate_ids: list[int] = Field(default_factory=list)
    default_driver_id: Optional[int] = None


class TankerUpdate(BaseModel):
    """Tanker update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=50)
    registration: Optional[str] = Field(None, max_length=50)
    max_capacity: Optional[int] = Field(None, gt=0)
    delivery_type: Optional[DeliveryType] = None
    status: Optional[TankerStatus] = None
    is_3pl: Optional[bool] = None
    fuel_blend_ids: Optional[list[int]] = None
    emirate_ids: Optional[list[int]] = None
    default_driver_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class DriverBasicResponse(BaseModel):
    """Basic driver info for tanker response."""

    id: int
    name: str

    class Config:
        from_attributes = True


class TankerResponse(BaseModel):
    """Tanker response schema."""

    id: int
    name: str
    registration: Optional[str]
    max_capacity: int
    delivery_type: DeliveryType
    status: TankerStatus
    is_3pl: bool
    fuel_blends: list[FuelBlendResponse]
    emirates: list[EmirateResponse]
    default_driver: Optional[DriverBasicResponse]
    notes: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TankersListResponse(BaseModel):
    """Paginated tankers list response."""

    items: list[TankerResponse]
    total: int
    page: int
    per_page: int
    pages: int


class TankerAvailabilitySlot(BaseModel):
    """Time slot for tanker availability."""

    start: str
    end: str
    customer: Optional[str] = None


class TankerAvailabilityResponse(BaseModel):
    """Tanker availability response."""

    tanker_id: int
    tanker_name: str
    date: str
    booked_slots: list[TankerAvailabilitySlot]
    available_slots: list[TankerAvailabilitySlot]
