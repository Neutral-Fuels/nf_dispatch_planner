"""Daily schedule and trip management endpoints."""

from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Path, status

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.schedule import DailySchedule, Trip, TripStatus, WeeklyTemplate
from app.schemas.schedule import (
    DailyScheduleResponse,
    GenerateScheduleRequest,
    GenerateScheduleResponse,
    ScheduleSummary,
    TripAssignment,
    TripCreate,
    TripResponse,
    TripUpdate,
)

router = APIRouter()


def get_day_of_week(d: date) -> int:
    """Convert Python weekday (Mon=0) to UAE week (Sat=0)."""
    # Python: Monday=0, Sunday=6
    # UAE: Saturday=0, Friday=6
    return (d.weekday() + 2) % 7


def get_day_name(day_of_week: int) -> str:
    """Get day name from UAE day of week."""
    days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    return days[day_of_week]


def calculate_summary(trips: list[Trip]) -> ScheduleSummary:
    """Calculate schedule summary statistics."""
    total = len(trips)
    unassigned = sum(1 for t in trips if t.tanker_id is None)
    conflicts = sum(1 for t in trips if t.status == TripStatus.CONFLICT)
    assigned = total - unassigned - conflicts
    total_volume = sum(t.volume for t in trips)

    return ScheduleSummary(
        total_trips=total,
        assigned_trips=assigned,
        unassigned_trips=unassigned,
        conflict_trips=conflicts,
        total_volume=total_volume,
    )


@router.get("/{schedule_date}")
def get_schedule(
    schedule_date: date = Path(..., description="Date in YYYY-MM-DD format"),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    """
    Get the daily schedule for a specific date.

    Returns the schedule with all trips and summary statistics.
    """
    schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == schedule_date)
        .first()
    )

    if not schedule:
        # Return empty schedule structure
        day_of_week = get_day_of_week(schedule_date)
        return {
            "id": None,
            "schedule_date": schedule_date,
            "day_of_week": day_of_week,
            "day_name": get_day_name(day_of_week),
            "is_locked": False,
            "trips": [],
            "summary": ScheduleSummary(
                total_trips=0,
                assigned_trips=0,
                unassigned_trips=0,
                conflict_trips=0,
                total_volume=0,
            ),
            "notes": None,
            "created_at": None,
        }

    return {
        "id": schedule.id,
        "schedule_date": schedule.schedule_date,
        "day_of_week": schedule.day_of_week,
        "day_name": get_day_name(schedule.day_of_week),
        "is_locked": schedule.is_locked,
        "trips": schedule.trips,
        "summary": calculate_summary(schedule.trips),
        "notes": schedule.notes,
        "created_at": schedule.created_at,
    }


@router.post("/{schedule_date}/generate", response_model=GenerateScheduleResponse)
def generate_schedule(
    schedule_date: date,
    request: GenerateScheduleRequest,
    db: DbSession,
    editor: EditorUser,
):
    """
    Generate a daily schedule from weekly templates.

    - **overwrite_existing**: If true, delete existing trips and regenerate
    """
    day_of_week = get_day_of_week(schedule_date)

    # Check if schedule exists
    existing_schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == schedule_date)
        .first()
    )

    if existing_schedule:
        if existing_schedule.is_locked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Schedule is locked and cannot be modified",
            )

        if not request.overwrite_existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Schedule already exists. Set overwrite_existing=true to regenerate.",
            )

        # Delete existing trips
        db.query(Trip).filter(
            Trip.daily_schedule_id == existing_schedule.id
        ).delete()
        schedule = existing_schedule
    else:
        # Create new schedule
        schedule = DailySchedule(
            schedule_date=schedule_date,
            day_of_week=day_of_week,
            created_by=editor.id,
        )
        db.add(schedule)
        db.flush()

    # Get templates for this day of week
    templates = (
        db.query(WeeklyTemplate)
        .filter(WeeklyTemplate.day_of_week == day_of_week)
        .filter(WeeklyTemplate.is_active == True)
        .order_by(WeeklyTemplate.start_time, WeeklyTemplate.priority)
        .all()
    )

    # Generate trips from templates
    trips_created = 0
    for template in templates:
        trip = Trip(
            daily_schedule_id=schedule.id,
            template_id=template.id,
            customer_id=template.customer_id,
            tanker_id=template.tanker_id,
            start_time=template.start_time,
            end_time=template.end_time,
            fuel_blend_id=template.fuel_blend_id,
            volume=template.volume,
            is_mobile_op=template.is_mobile_op,
            needs_return=template.needs_return,
            status=TripStatus.SCHEDULED if template.tanker_id else TripStatus.UNASSIGNED,
            notes=template.notes,
        )
        db.add(trip)
        trips_created += 1

    db.commit()

    return GenerateScheduleResponse(
        schedule_id=schedule.id,
        schedule_date=schedule_date,
        trips_created=trips_created,
        trips_skipped=0,
        message=f"Generated {trips_created} trips from templates",
    )


@router.post("/{schedule_date}/lock")
def lock_schedule(
    schedule_date: date,
    db: DbSession,
    editor: EditorUser,
):
    """Lock a schedule to prevent further modifications."""
    schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == schedule_date)
        .first()
    )

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )

    schedule.is_locked = True
    db.commit()

    return {"message": f"Schedule for {schedule_date} locked"}


@router.post("/{schedule_date}/unlock")
def unlock_schedule(
    schedule_date: date,
    db: DbSession,
    editor: EditorUser,
):
    """Unlock a schedule to allow modifications."""
    schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == schedule_date)
        .first()
    )

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )

    schedule.is_locked = False
    db.commit()

    return {"message": f"Schedule for {schedule_date} unlocked"}


@router.post("/{schedule_date}/trips", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
def create_trip(
    schedule_date: date,
    trip_data: TripCreate,
    db: DbSession,
    editor: EditorUser,
):
    """Create an ad-hoc trip for a specific date."""
    day_of_week = get_day_of_week(schedule_date)

    # Get or create schedule
    schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == schedule_date)
        .first()
    )

    if not schedule:
        schedule = DailySchedule(
            schedule_date=schedule_date,
            day_of_week=day_of_week,
            created_by=editor.id,
        )
        db.add(schedule)
        db.flush()

    if schedule.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule is locked",
        )

    # Create trip
    trip = Trip(
        daily_schedule_id=schedule.id,
        status=TripStatus.SCHEDULED if trip_data.tanker_id else TripStatus.UNASSIGNED,
        **trip_data.model_dump(),
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)

    return trip


# Trip-level endpoints
@router.get("/trips/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get a specific trip by ID."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )
    return trip


@router.put("/trips/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: int,
    trip_data: TripUpdate,
    db: DbSession,
    editor: EditorUser,
):
    """Update a trip."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    if trip.daily_schedule.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule is locked",
        )

    # Update fields
    update_data = trip_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trip, field, value)

    # Update status based on tanker assignment
    if trip.tanker_id is None:
        trip.status = TripStatus.UNASSIGNED

    db.commit()
    db.refresh(trip)

    return trip


@router.patch("/trips/{trip_id}/assign", response_model=TripResponse)
def assign_trip(
    trip_id: int,
    assignment: TripAssignment,
    db: DbSession,
    editor: EditorUser,
):
    """Assign tanker and/or driver to a trip."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    if trip.daily_schedule.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule is locked",
        )

    # TODO: Add tanker validation (capacity, blend, emirate, delivery type)

    if assignment.tanker_id is not None:
        trip.tanker_id = assignment.tanker_id
        trip.status = TripStatus.SCHEDULED

    if assignment.driver_id is not None:
        trip.driver_id = assignment.driver_id

    db.commit()
    db.refresh(trip)

    return trip


@router.delete("/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
    trip_id: int,
    db: DbSession,
    editor: EditorUser,
):
    """Delete a trip."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    if trip.daily_schedule.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule is locked",
        )

    db.delete(trip)
    db.commit()
