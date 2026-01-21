"""Tanker management endpoints."""

from math import ceil
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.driver import Driver
from app.models.reference import Emirate, FuelBlend
from app.models.tanker import DeliveryType, Tanker, TankerStatus
from app.schemas.tanker import (
    TankerCreate,
    TankerResponse,
    TankersListResponse,
    TankerUpdate,
)

router = APIRouter()


@router.get("", response_model=TankersListResponse)
def list_tankers(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    delivery_type: Optional[DeliveryType] = None,
    status: Optional[TankerStatus] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
):
    """
    List all tankers with pagination and filtering.

    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 20, max: 100)
    - **delivery_type**: Filter by delivery type (bulk, mobile, both)
    - **status**: Filter by status (active, maintenance, inactive)
    - **is_active**: Filter by active status
    - **search**: Search in name or registration
    """
    query = db.query(Tanker)

    # Apply filters
    if delivery_type:
        query = query.filter(Tanker.delivery_type == delivery_type)
    if status:
        query = query.filter(Tanker.status == status)
    if is_active is not None:
        query = query.filter(Tanker.is_active == is_active)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Tanker.name.ilike(search_term))
            | (Tanker.registration.ilike(search_term))
        )

    # Get total count
    total = query.count()

    # Paginate
    tankers = (
        query.order_by(Tanker.name)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return TankersListResponse(
        items=tankers,
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total > 0 else 1,
    )


@router.post("", response_model=TankerResponse, status_code=status.HTTP_201_CREATED)
def create_tanker(
    tanker_data: TankerCreate,
    db: DbSession,
    editor: EditorUser,
):
    """Create a new tanker with fuel blend and emirate associations."""
    # Get fuel blends
    fuel_blends = []
    if tanker_data.fuel_blend_ids:
        fuel_blends = db.query(FuelBlend).filter(
            FuelBlend.id.in_(tanker_data.fuel_blend_ids)
        ).all()

    # Get emirates
    emirates = []
    if tanker_data.emirate_ids:
        emirates = db.query(Emirate).filter(
            Emirate.id.in_(tanker_data.emirate_ids)
        ).all()

    # Validate default driver
    if tanker_data.default_driver_id:
        driver = db.query(Driver).filter(Driver.id == tanker_data.default_driver_id).first()
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Default driver not found",
            )

    # Create tanker
    tanker_dict = tanker_data.model_dump(
        exclude={"fuel_blend_ids", "emirate_ids"}
    )
    tanker = Tanker(**tanker_dict)
    tanker.fuel_blends = fuel_blends
    tanker.emirates = emirates

    db.add(tanker)
    db.commit()
    db.refresh(tanker)

    return tanker


@router.get("/{tanker_id}", response_model=TankerResponse)
def get_tanker(
    tanker_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get a specific tanker by ID."""
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tanker not found",
        )
    return tanker


@router.put("/{tanker_id}", response_model=TankerResponse)
def update_tanker(
    tanker_id: int,
    tanker_data: TankerUpdate,
    db: DbSession,
    editor: EditorUser,
):
    """Update a tanker."""
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tanker not found",
        )

    # Update fuel blends if provided
    if tanker_data.fuel_blend_ids is not None:
        fuel_blends = db.query(FuelBlend).filter(
            FuelBlend.id.in_(tanker_data.fuel_blend_ids)
        ).all()
        tanker.fuel_blends = fuel_blends

    # Update emirates if provided
    if tanker_data.emirate_ids is not None:
        emirates = db.query(Emirate).filter(
            Emirate.id.in_(tanker_data.emirate_ids)
        ).all()
        tanker.emirates = emirates

    # Update other fields
    update_data = tanker_data.model_dump(
        exclude_unset=True,
        exclude={"fuel_blend_ids", "emirate_ids"}
    )
    for field, value in update_data.items():
        setattr(tanker, field, value)

    db.commit()
    db.refresh(tanker)

    return tanker


@router.delete("/{tanker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tanker(
    tanker_id: int,
    db: DbSession,
    editor: EditorUser,
):
    """Deactivate a tanker (soft delete)."""
    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tanker not found",
        )

    tanker.is_active = False
    db.commit()
