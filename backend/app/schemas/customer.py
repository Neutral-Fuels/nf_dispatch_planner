"""Customer schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.customer import CustomerType
from app.schemas.reference import EmirateResponse, FuelBlendResponse


class CustomerBase(BaseModel):
    """Base customer schema."""

    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    customer_type: CustomerType
    estimated_volume: Optional[int] = Field(None, gt=0)
    address: Optional[str] = None
    contact_name: Optional[str] = Field(None, max_length=100)
    contact_phone: Optional[str] = Field(None, max_length=20)
    contact_email: Optional[EmailStr] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    """Customer creation schema."""

    fuel_blend_id: Optional[int] = None
    emirate_id: Optional[int] = None


class CustomerUpdate(BaseModel):
    """Customer update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    customer_type: Optional[CustomerType] = None
    fuel_blend_id: Optional[int] = None
    estimated_volume: Optional[int] = Field(None, gt=0)
    emirate_id: Optional[int] = None
    address: Optional[str] = None
    contact_name: Optional[str] = Field(None, max_length=100)
    contact_phone: Optional[str] = Field(None, max_length=20)
    contact_email: Optional[EmailStr] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerResponse(BaseModel):
    """Customer response schema."""

    id: int
    name: str
    code: str
    customer_type: CustomerType
    fuel_blend: Optional[FuelBlendResponse]
    estimated_volume: Optional[int]
    emirate: Optional[EmirateResponse]
    address: Optional[str]
    contact_name: Optional[str]
    contact_phone: Optional[str]
    contact_email: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CustomersListResponse(BaseModel):
    """Paginated customers list response."""

    items: list[CustomerResponse]
    total: int
    page: int
    per_page: int
    pages: int
