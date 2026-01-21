"""Driver management endpoints."""

from datetime import date, timedelta
from math import ceil
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.driver import Driver, DriverSchedule, DriverStatus, DriverType
from app.schemas.driver import (
    DriverCreate,
    DriverResponse,
    DriversListResponse,
    DriverScheduleBulkCreate,
    DriverScheduleCreate,
    DriverScheduleResponse,
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


# ============================================
# Driver Schedule Endpoints
# ============================================

@router.get("/{driver_id}/schedule", response_model=list[DriverScheduleResponse])
def get_driver_schedule(
    driver_id: int,
    db: DbSession,
    current_user: CurrentUser,
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """
    Get driver schedule for a date range.

    - **driver_id**: Driver ID
    - **start_date**: Start date (YYYY-MM-DD)
    - **end_date**: End date (YYYY-MM-DD)
    """
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    schedules = (
        db.query(DriverSchedule)
        .filter(DriverSchedule.driver_id == driver_id)
        .filter(DriverSchedule.schedule_date >= start_date)
        .filter(DriverSchedule.schedule_date <= end_date)
        .order_by(DriverSchedule.schedule_date)
        .all()
    )

    return schedules


@router.post("/{driver_id}/schedule", response_model=DriverScheduleResponse, status_code=status.HTTP_201_CREATED)
def set_driver_schedule(
    driver_id: int,
    schedule_data: DriverScheduleCreate,
    db: DbSession,
    editor: EditorUser,
):
    """
    Set driver availability for a specific date.

    Creates or updates the schedule entry for the date.
    """
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    # Check if schedule exists for this date
    existing = (
        db.query(DriverSchedule)
        .filter(DriverSchedule.driver_id == driver_id)
        .filter(DriverSchedule.schedule_date == schedule_data.date)
        .first()
    )

    if existing:
        existing.status = schedule_data.status
        existing.notes = schedule_data.notes
        schedule = existing
    else:
        schedule = DriverSchedule(
            driver_id=driver_id,
            schedule_date=schedule_data.date,
            status=schedule_data.status,
            notes=schedule_data.notes,
        )
        db.add(schedule)

    db.commit()
    db.refresh(schedule)

    return schedule


@router.post("/{driver_id}/schedule/bulk", response_model=dict)
def set_driver_schedule_bulk(
    driver_id: int,
    bulk_data: DriverScheduleBulkCreate,
    db: DbSession,
    editor: EditorUser,
):
    """
    Set driver schedule for a date range using a weekly pattern.

    The pattern should have 7 statuses, one for each day of the UAE week
    (0=Saturday, 6=Friday).
    """
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    if len(bulk_data.pattern) != 7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pattern must have exactly 7 statuses (one for each day)",
        )

    created = 0
    updated = 0
    current_date = bulk_data.start_date

    while current_date <= bulk_data.end_date:
        # Get UAE day of week (Saturday=0)
        day_of_week = (current_date.weekday() + 2) % 7
        status_for_day = bulk_data.pattern[day_of_week]

        # Check if schedule exists
        existing = (
            db.query(DriverSchedule)
            .filter(DriverSchedule.driver_id == driver_id)
            .filter(DriverSchedule.schedule_date == current_date)
            .first()
        )

        if existing:
            existing.status = status_for_day
            updated += 1
        else:
            schedule = DriverSchedule(
                driver_id=driver_id,
                schedule_date=current_date,
                status=status_for_day,
            )
            db.add(schedule)
            created += 1

        current_date += timedelta(days=1)

    db.commit()

    return {
        "message": f"Schedule updated for {bulk_data.start_date} to {bulk_data.end_date}",
        "created": created,
        "updated": updated,
    }


@router.get("/schedules/all", response_model=dict)
def get_all_driver_schedules(
    db: DbSession,
    current_user: CurrentUser,
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """
    Get schedule for all active drivers in a date range.

    Returns a dictionary with driver_id as key and list of schedules as value.
    """
    drivers = db.query(Driver).filter(Driver.is_active == True).all()

    schedules = (
        db.query(DriverSchedule)
        .filter(DriverSchedule.schedule_date >= start_date)
        .filter(DriverSchedule.schedule_date <= end_date)
        .order_by(DriverSchedule.driver_id, DriverSchedule.schedule_date)
        .all()
    )

    # Group by driver
    result = {}
    for driver in drivers:
        result[driver.id] = {
            "driver_name": driver.name,
            "driver_type": driver.driver_type.value,
            "schedules": [],
        }

    for schedule in schedules:
        if schedule.driver_id in result:
            result[schedule.driver_id]["schedules"].append({
                "date": schedule.schedule_date.isoformat(),
                "status": schedule.status.value,
                "notes": schedule.notes,
            })

    return result


@router.get("/{driver_id}/trips")
def get_driver_trips(
    driver_id: int,
    db: DbSession,
    current_user: CurrentUser,
    schedule_date: date = Query(...),
):
    """
    Get trips assigned to a driver for a specific date.

    Used for generating driver trip sheets.
    """
    from app.models.schedule import DailySchedule, Trip

    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    trips = (
        db.query(Trip)
        .join(DailySchedule)
        .filter(DailySchedule.schedule_date == schedule_date)
        .filter(Trip.driver_id == driver_id)
        .order_by(Trip.start_time)
        .all()
    )

    return {
        "driver": {
            "id": driver.id,
            "name": driver.name,
            "employee_id": driver.employee_id,
            "driver_type": driver.driver_type.value,
        },
        "date": schedule_date.isoformat(),
        "trips": [
            {
                "id": trip.id,
                "customer": {
                    "code": trip.customer.code,
                    "name": trip.customer.name,
                    "address": trip.customer.address,
                },
                "tanker": {
                    "id": trip.tanker.id,
                    "name": trip.tanker.name,
                } if trip.tanker else None,
                "start_time": trip.start_time.isoformat(),
                "end_time": trip.end_time.isoformat(),
                "fuel_blend": trip.fuel_blend.code if trip.fuel_blend else None,
                "volume": trip.volume,
                "is_mobile_op": trip.is_mobile_op,
                "needs_return": trip.needs_return,
                "notes": trip.notes,
            }
            for trip in trips
        ],
        "total_trips": len(trips),
        "total_volume": sum(t.volume for t in trips),
    }
