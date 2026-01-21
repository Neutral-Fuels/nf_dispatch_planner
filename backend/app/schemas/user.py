"""User schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    """Base user schema."""

    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=100)
    role: UserRole = UserRole.VIEWER


class UserCreate(UserBase):
    """User creation schema."""

    password: str = Field(..., min_length=8, max_length=100)


class UserUpdate(BaseModel):
    """User update schema."""

    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """User response schema."""

    id: int
    username: str
    email: str
    full_name: Optional[str]
    role: UserRole
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class UserInDB(UserResponse):
    """User schema with password hash (internal use)."""

    password_hash: str


class UsersListResponse(BaseModel):
    """Paginated users list response."""

    items: list[UserResponse]
    total: int
    page: int
    per_page: int
    pages: int


class AdminPasswordReset(BaseModel):
    """Admin password reset schema (no current password required)."""

    new_password: str = Field(..., min_length=8, max_length=100)
