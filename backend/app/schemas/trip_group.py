"""Trip Group schemas for weekly driver assignments."""

from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, Field


# Basic response schemas for nested objects
class DriverBasicResponse(BaseModel):
    """Basic driver info."""

    id: int
    name: str

    class Config:
        from_attributes = True


class UserBasicResponse(BaseModel):
    """Basic user info."""

    id: int
    username: str

    class Config:
        from_attributes = True


class CustomerBasicResponse(BaseModel):
    """Basic customer info."""

    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


class TankerBasicResponse(BaseModel):
    """Basic tanker info."""

    id: int
    name: str

    class Config:
        from_attributes = True


class TemplateBasicResponse(BaseModel):
    """Basic template info for trip group."""

    id: int
    customer: CustomerBasicResponse
    day_of_week: int
    day_name: str
    start_time: time
    end_time: time
    volume: int
    tanker: Optional[TankerBasicResponse]

    class Config:
        from_attributes = True


# Trip Group Schemas
class TripGroupBase(BaseModel):
    """Base trip group schema."""

    name: str = Field(..., min_length=1, max_length=100)
    day_of_week: int = Field(..., ge=0, le=6)  # 0=Saturday, 6=Friday
    description: Optional[str] = None


class TripGroupCreate(TripGroupBase):
    """Trip group creation schema."""

    template_ids: list[int] = Field(default_factory=list)


class TripGroupUpdate(BaseModel):
    """Trip group update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    template_ids: Optional[list[int]] = None


class TripGroupResponse(BaseModel):
    """Trip group response schema."""

    id: int
    name: str
    day_of_week: int
    day_name: str
    description: Optional[str]
    is_active: bool
    templates: list[TemplateBasicResponse]
    template_count: int
    # Time calculations
    earliest_start_time: Optional[time]
    latest_end_time: Optional[time]
    total_duration_minutes: Optional[int]
    total_volume: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_count(cls, obj):
        """Create response with computed fields."""
        data = {
            "id": obj.id,
            "name": obj.name,
            "day_of_week": obj.day_of_week,
            "day_name": obj.day_name,
            "description": obj.description,
            "is_active": obj.is_active,
            "templates": obj.templates,
            "template_count": len(obj.templates),
            "earliest_start_time": obj.earliest_start_time,
            "latest_end_time": obj.latest_end_time,
            "total_duration_minutes": obj.total_duration_minutes,
            "total_volume": obj.total_volume,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
        }
        return cls(**data)


class TripGroupListResponse(BaseModel):
    """Trip group list response (without full template details)."""

    id: int
    name: str
    day_of_week: int
    day_name: str
    description: Optional[str]
    is_active: bool
    template_count: int
    template_ids: list[int]  # IDs of assigned templates
    # Time calculations
    earliest_start_time: Optional[time]
    latest_end_time: Optional[time]
    total_duration_minutes: Optional[int]
    total_volume: int
    created_at: datetime

    class Config:
        from_attributes = True


class TripGroupsListResponse(BaseModel):
    """Paginated trip groups list response."""

    items: list[TripGroupListResponse]
    total: int
    page: int
    per_page: int
    pages: int


class AddTemplateRequest(BaseModel):
    """Request to add templates to a trip group."""

    template_ids: list[int]


class RemoveTemplateRequest(BaseModel):
    """Request to remove templates from a trip group."""

    template_ids: list[int]


# Weekly Driver Assignment Schemas
class WeeklyDriverAssignmentBase(BaseModel):
    """Base weekly driver assignment schema."""

    trip_group_id: int
    driver_id: int
    week_start_date: date
    notes: Optional[str] = None


class WeeklyDriverAssignmentCreate(WeeklyDriverAssignmentBase):
    """Weekly driver assignment creation schema."""

    pass


class WeeklyDriverAssignmentUpdate(BaseModel):
    """Weekly driver assignment update schema."""

    driver_id: Optional[int] = None
    notes: Optional[str] = None


class TripGroupBasicResponse(BaseModel):
    """Basic trip group info for assignment response."""

    id: int
    name: str
    day_of_week: int
    day_name: str
    description: Optional[str]

    class Config:
        from_attributes = True


class WeeklyDriverAssignmentResponse(BaseModel):
    """Weekly driver assignment response schema."""

    id: int
    trip_group: TripGroupBasicResponse
    driver: DriverBasicResponse
    week_start_date: date
    assigned_at: datetime
    assigned_by_user: Optional[UserBasicResponse]
    notes: Optional[str]

    class Config:
        from_attributes = True


class WeeklyAssignmentsListResponse(BaseModel):
    """List of weekly driver assignments."""

    week_start_date: date
    assignments: list[WeeklyDriverAssignmentResponse]
    unassigned_groups: list[TripGroupBasicResponse]
    available_drivers: list[DriverBasicResponse]


# Auto-Assignment Schemas
class AutoAssignRequest(BaseModel):
    """Request to auto-assign drivers for a week."""

    week_start_date: date
    min_rest_hours: int = Field(default=12, ge=8, le=24)
    dry_run: bool = False  # If true, just return what would be assigned


class AutoAssignmentPreview(BaseModel):
    """Preview of a single auto-assignment."""

    trip_group: TripGroupBasicResponse
    driver: Optional[DriverBasicResponse]
    reason: Optional[str] = None  # Reason if unassigned


class AutoAssignResponse(BaseModel):
    """Response from auto-assignment."""

    week_start_date: date
    assignments_created: int
    groups_unassigned: int
    assignments: list[WeeklyDriverAssignmentResponse]
    unassigned: list[AutoAssignmentPreview]
    message: str


class RestGapWarning(BaseModel):
    """Warning about rest gap issues."""

    driver_id: int
    driver_name: str
    day_from: int
    day_to: int
    end_time: time
    start_time: time
    gap_hours: float
    min_required: int
