"""Schedule schemas - Weekly Templates, Daily Schedules, Trips."""

from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, Field

from app.models.schedule import TripStatus
from app.schemas.customer import CustomerResponse
from app.schemas.driver import DriverResponse
from app.schemas.reference import FuelBlendResponse
from app.schemas.tanker import TankerResponse


# Weekly Template Schemas
class WeeklyTemplateBase(BaseModel):
    """Base weekly template schema."""

    customer_id: int
    day_of_week: int = Field(..., ge=0, le=6)  # 0=Saturday, 6=Friday
    start_time: time
    end_time: time
    volume: int = Field(..., gt=0)
    is_mobile_op: bool = False
    needs_return: bool = False
    priority: int = 0
    notes: Optional[str] = None


class WeeklyTemplateCreate(WeeklyTemplateBase):
    """Weekly template creation schema."""

    tanker_id: Optional[int] = None
    fuel_blend_id: Optional[int] = None


class WeeklyTemplateUpdate(BaseModel):
    """Weekly template update schema."""

    customer_id: Optional[int] = None
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    tanker_id: Optional[int] = None
    fuel_blend_id: Optional[int] = None
    volume: Optional[int] = Field(None, gt=0)
    is_mobile_op: Optional[bool] = None
    needs_return: Optional[bool] = None
    priority: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerBasicResponse(BaseModel):
    """Basic customer info for template response."""

    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


class TankerBasicResponse(BaseModel):
    """Basic tanker info for template response."""

    id: int
    name: str

    class Config:
        from_attributes = True


class FuelBlendBasicResponse(BaseModel):
    """Basic fuel blend info."""

    id: int
    code: str

    class Config:
        from_attributes = True


class WeeklyTemplateResponse(BaseModel):
    """Weekly template response schema."""

    id: int
    customer: CustomerBasicResponse
    day_of_week: int
    day_name: str
    start_time: time
    end_time: time
    tanker: Optional[TankerBasicResponse]
    fuel_blend: Optional[FuelBlendBasicResponse]
    volume: int
    is_mobile_op: bool
    needs_return: bool
    priority: int
    notes: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class WeeklyTemplatesListResponse(BaseModel):
    """Paginated weekly templates list response."""

    items: list[WeeklyTemplateResponse]
    total: int
    page: int
    per_page: int
    pages: int


# Trip Schemas
class TripBase(BaseModel):
    """Base trip schema."""

    customer_id: int
    start_time: time
    end_time: time
    volume: int = Field(..., gt=0)
    is_mobile_op: bool = False
    needs_return: bool = False
    notes: Optional[str] = None


class TripCreate(TripBase):
    """Trip creation schema."""

    tanker_id: Optional[int] = None
    driver_id: Optional[int] = None
    fuel_blend_id: Optional[int] = None


class TripUpdate(BaseModel):
    """Trip update schema."""

    customer_id: Optional[int] = None
    tanker_id: Optional[int] = None
    driver_id: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    fuel_blend_id: Optional[int] = None
    volume: Optional[int] = Field(None, gt=0)
    is_mobile_op: Optional[bool] = None
    needs_return: Optional[bool] = None
    status: Optional[TripStatus] = None
    notes: Optional[str] = None


class TripAssignment(BaseModel):
    """Trip assignment schema for assigning tanker/driver."""

    tanker_id: Optional[int] = None
    driver_id: Optional[int] = None


class DriverBasicResponse(BaseModel):
    """Basic driver info for trip response."""

    id: int
    name: str

    class Config:
        from_attributes = True


class TripResponse(BaseModel):
    """Trip response schema."""

    id: int
    daily_schedule_id: int
    template_id: Optional[int]
    customer: CustomerBasicResponse
    tanker: Optional[TankerBasicResponse]
    driver: Optional[DriverBasicResponse]
    start_time: time
    end_time: time
    fuel_blend: Optional[FuelBlendBasicResponse]
    volume: int
    is_mobile_op: bool
    needs_return: bool
    status: TripStatus
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Daily Schedule Schemas
class ScheduleSummary(BaseModel):
    """Summary statistics for a daily schedule."""

    total_trips: int
    assigned_trips: int
    unassigned_trips: int
    conflict_trips: int
    total_volume: int


class DailyScheduleResponse(BaseModel):
    """Daily schedule response schema."""

    id: int
    schedule_date: date
    day_of_week: int
    day_name: str
    is_locked: bool
    trips: list[TripResponse]
    summary: ScheduleSummary
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

    @property
    def day_name(self) -> str:
        """Get day name from day_of_week."""
        days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        return days[self.day_of_week]


class GenerateScheduleRequest(BaseModel):
    """Request to generate a schedule from template."""

    overwrite_existing: bool = False


class GenerateScheduleResponse(BaseModel):
    """Response after generating a schedule."""

    schedule_id: int
    schedule_date: date
    trips_created: int
    trips_skipped: int
    message: str


# Trip Group Schedule View Schemas
class TripGroupScheduleItem(BaseModel):
    """A trip group with its assigned driver and trips for the schedule view."""

    id: int
    name: str
    day_of_week: int
    day_name: str
    description: Optional[str]
    driver: Optional[DriverBasicResponse]  # From weekly assignment
    trips: list[TripResponse]
    earliest_start_time: Optional[time]
    latest_end_time: Optional[time]
    total_volume: int
    template_count: int


class UnassignedTripsGroup(BaseModel):
    """Trips that don't belong to any group (ad-hoc or orphaned)."""

    trips: list[TripResponse]
    total_volume: int


class TripGroupScheduleResponse(BaseModel):
    """Schedule response organized by trip groups."""

    id: Optional[int]
    schedule_date: date
    day_of_week: int
    day_name: str
    is_locked: bool
    trip_groups: list[TripGroupScheduleItem]
    unassigned_trips: UnassignedTripsGroup  # Trips not in any group
    summary: ScheduleSummary
    notes: Optional[str]
    created_at: Optional[datetime]


# On-Demand Delivery Schemas
class OnDemandDeliveryRequest(BaseModel):
    """Request to create an on-demand delivery with auto-assignment."""

    customer_id: int
    fuel_blend_id: Optional[int] = None
    volume: int = Field(..., gt=0)
    preferred_start_time: Optional[time] = None
    preferred_end_time: Optional[time] = None
    notes: Optional[str] = None
    auto_assign: bool = True  # If True, auto-assign tanker and find time slot


class OnDemandDeliveryResponse(BaseModel):
    """Response after creating an on-demand delivery."""

    trip: TripResponse
    auto_assigned: bool
    assigned_tanker: Optional[TankerBasicResponse]
    message: str
