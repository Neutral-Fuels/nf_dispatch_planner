"""Pydantic schemas for API request/response validation."""

from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
)
from app.schemas.user import (
    UserCreate,
    UserInDB,
    UserResponse,
    UserUpdate,
    UsersListResponse,
)
from app.schemas.reference import EmirateResponse, FuelBlendResponse
from app.schemas.driver import (
    DriverCreate,
    DriverResponse,
    DriverUpdate,
    DriversListResponse,
    DriverScheduleCreate,
    DriverScheduleResponse,
)
from app.schemas.tanker import (
    TankerCreate,
    TankerResponse,
    TankerUpdate,
    TankersListResponse,
)
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    CustomersListResponse,
)
from app.schemas.schedule import (
    WeeklyTemplateCreate,
    WeeklyTemplateResponse,
    WeeklyTemplateUpdate,
    DailyScheduleResponse,
    TripCreate,
    TripResponse,
    TripUpdate,
    TripAssignment,
)

__all__ = [
    # Auth
    "LoginRequest",
    "TokenResponse",
    "ChangePasswordRequest",
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserInDB",
    "UsersListResponse",
    # Reference
    "EmirateResponse",
    "FuelBlendResponse",
    # Driver
    "DriverCreate",
    "DriverUpdate",
    "DriverResponse",
    "DriversListResponse",
    "DriverScheduleCreate",
    "DriverScheduleResponse",
    # Tanker
    "TankerCreate",
    "TankerUpdate",
    "TankerResponse",
    "TankersListResponse",
    # Customer
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerResponse",
    "CustomersListResponse",
    # Schedule
    "WeeklyTemplateCreate",
    "WeeklyTemplateResponse",
    "WeeklyTemplateUpdate",
    "DailyScheduleResponse",
    "TripCreate",
    "TripResponse",
    "TripUpdate",
    "TripAssignment",
]
