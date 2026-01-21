"""Customer management endpoints."""

from math import ceil
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.customer import Customer, CustomerType
from app.models.reference import Emirate, FuelBlend
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomersListResponse,
    CustomerUpdate,
)

router = APIRouter()


@router.get("", response_model=CustomersListResponse)
def list_customers(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    customer_type: Optional[CustomerType] = None,
    emirate_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
):
    """
    List all customers with pagination and filtering.

    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 20, max: 100)
    - **customer_type**: Filter by type (bulk, mobile)
    - **emirate_id**: Filter by emirate
    - **is_active**: Filter by active status
    - **search**: Search in name or code
    """
    query = db.query(Customer)

    # Apply filters
    if customer_type:
        query = query.filter(Customer.customer_type == customer_type)
    if emirate_id:
        query = query.filter(Customer.emirate_id == emirate_id)
    if is_active is not None:
        query = query.filter(Customer.is_active == is_active)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Customer.name.ilike(search_term))
            | (Customer.code.ilike(search_term))
        )

    # Get total count
    total = query.count()

    # Paginate
    customers = (
        query.order_by(Customer.code)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return CustomersListResponse(
        items=customers,
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total > 0 else 1,
    )


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_data: CustomerCreate,
    db: DbSession,
    editor: EditorUser,
):
    """Create a new customer."""
    # Check if code exists
    if db.query(Customer).filter(Customer.code == customer_data.code).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer code already exists",
        )

    # Validate fuel blend
    if customer_data.fuel_blend_id:
        blend = db.query(FuelBlend).filter(
            FuelBlend.id == customer_data.fuel_blend_id
        ).first()
        if not blend:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fuel blend not found",
            )

    # Validate emirate
    if customer_data.emirate_id:
        emirate = db.query(Emirate).filter(
            Emirate.id == customer_data.emirate_id
        ).first()
        if not emirate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Emirate not found",
            )

    customer = Customer(**customer_data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get a specific customer by ID."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    customer_data: CustomerUpdate,
    db: DbSession,
    editor: EditorUser,
):
    """Update a customer."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    # Check code uniqueness if updating
    if customer_data.code and customer_data.code != customer.code:
        if db.query(Customer).filter(Customer.code == customer_data.code).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer code already exists",
            )

    # Update fields
    update_data = customer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)

    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: DbSession,
    editor: EditorUser,
):
    """Deactivate a customer (soft delete)."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    customer.is_active = False
    db.commit()
