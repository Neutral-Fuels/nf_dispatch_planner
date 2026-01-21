"""Driver schemas."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.driver import DriverStatus, DriverType


class DriverBase(BaseModel):
    """Base driver schema."""

    name: str = Field(..., min_length=1, max_length=100)
    employee_id: Optional[str] = Field(None, max_length=50)
    driver_type: DriverType = DriverType.INTERNAL
    contact_phone: Optional[str] = Field(None, max_length=20)
    license_number: Optional[str] = Field(None, max_length=50)
    license_expiry: Optional[date] = None
    notes: Optional[str] = None


class DriverCreate(DriverBase):
    """Driver creation schema."""

    pass


class DriverUpdate(BaseModel):
    """Driver update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    employee_id: Optional[str] = Field(None, max_length=50)
    driver_type: Optional[DriverType] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    license_number: Optional[str] = Field(None, max_length=50)
    license_expiry: Optional[date] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class DriverResponse(BaseModel):
    """Driver response schema."""

    id: int
    name: str
    employee_id: Optional[str]
    driver_type: DriverType
    contact_phone: Optional[str]
    license_number: Optional[str]
    license_expiry: Optional[date]
    notes: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DriversListResponse(BaseModel):
    """Paginated drivers list response."""

    items: list[DriverResponse]
    total: int
    page: int
    per_page: int
    pages: int


class DriverScheduleCreate(BaseModel):
    """Driver schedule creation schema."""

    date: date
    status: DriverStatus
    notes: Optional[str] = None


class DriverScheduleResponse(BaseModel):
    """Driver schedule response schema."""

    id: int
    driver_id: int
    schedule_date: date
    status: DriverStatus
    notes: Optional[str]

    class Config:
        from_attributes = True


class DriverScheduleBulkCreate(BaseModel):
    """Bulk driver schedule creation schema."""

    start_date: date
    end_date: date
    pattern: list[DriverStatus]  # 7 statuses for each day of week
