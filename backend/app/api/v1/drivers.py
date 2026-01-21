"""Driver management endpoints."""

from math import ceil
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.driver import Driver, DriverType
from app.schemas.driver import (
    DriverCreate,
    DriverResponse,
    DriversListResponse,
    DriverUpdate,
)

router = APIRouter()


@router.get("", response_model=DriversListResponse)
def list_drivers(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    driver_type: Optional[DriverType] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
):
    """
    List all drivers with pagination and filtering.

    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 20, max: 100)
    - **driver_type**: Filter by type (internal, 3pl)
    - **is_active**: Filter by active status
    - **search**: Search in name or employee_id
    """
    query = db.query(Driver)

    # Apply filters
    if driver_type:
        query = query.filter(Driver.driver_type == driver_type)
    if is_active is not None:
        query = query.filter(Driver.is_active == is_active)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Driver.name.ilike(search_term))
            | (Driver.employee_id.ilike(search_term))
        )

    # Get total count
    total = query.count()

    # Paginate
    drivers = (
        query.order_by(Driver.name)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return DriversListResponse(
        items=drivers,
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total > 0 else 1,
    )


@router.post("", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
def create_driver(
    driver_data: DriverCreate,
    db: DbSession,
    editor: EditorUser,
):
    """Create a new driver."""
    # Check if employee_id exists (if provided)
    if driver_data.employee_id:
        if db.query(Driver).filter(Driver.employee_id == driver_data.employee_id).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee ID already exists",
            )

    driver = Driver(**driver_data.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)

    return driver


@router.get("/{driver_id}", response_model=DriverResponse)
def get_driver(
    driver_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get a specific driver by ID."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )
    return driver


@router.put("/{driver_id}", response_model=DriverResponse)
def update_driver(
    driver_id: int,
    driver_data: DriverUpdate,
    db: DbSession,
    editor: EditorUser,
):
    """Update a driver."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    # Check employee_id uniqueness if updating
    if driver_data.employee_id and driver_data.employee_id != driver.employee_id:
        if db.query(Driver).filter(Driver.employee_id == driver_data.employee_id).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee ID already exists",
            )

    # Update fields
    update_data = driver_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(driver, field, value)

    db.commit()
    db.refresh(driver)

    return driver


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver(
    driver_id: int,
    db: DbSession,
    editor: EditorUser,
):
    """Deactivate a driver (soft delete)."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    driver.is_active = False
    db.commit()
