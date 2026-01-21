"""Daily schedule and trip management endpoints."""

from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Path, status

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.customer import Customer
from app.models.schedule import DailySchedule, Trip, TripStatus, WeeklyTemplate
from app.models.tanker import Tanker
from app.models.trip_group import TripGroup, WeeklyDriverAssignment, trip_group_templates
from app.services.validation import TripValidationService, ValidationResult
from app.schemas.schedule import (
    DailyScheduleResponse,
    GenerateScheduleRequest,
    GenerateScheduleResponse,
    OnDemandDeliveryRequest,
    OnDemandDeliveryResponse,
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


def get_week_start(d: date) -> date:
    """Get the Saturday that starts the week containing the given date."""
    # UAE week starts Saturday
    days_since_saturday = (d.weekday() + 2) % 7
    return d - timedelta(days=days_since_saturday)


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

    # Get week start for this date to look up driver assignments
    week_start = get_week_start(schedule_date)

    # Get all driver assignments for this week
    # Build a mapping from template_id to driver_id
    template_to_driver = {}
    assignments = (
        db.query(WeeklyDriverAssignment)
        .filter(WeeklyDriverAssignment.week_start_date == week_start)
        .all()
    )

    # For each assignment, get the trip group's templates and map them to the driver
    for assignment in assignments:
        trip_group = db.query(TripGroup).filter(TripGroup.id == assignment.trip_group_id).first()
        if trip_group:
            for group_template in trip_group.templates:
                template_to_driver[group_template.id] = assignment.driver_id

    # Generate trips from templates
    trips_created = 0
    for template in templates:
        # Look up driver from weekly assignment
        driver_id = template_to_driver.get(template.id)

        trip = Trip(
            daily_schedule_id=schedule.id,
            template_id=template.id,
            customer_id=template.customer_id,
            tanker_id=template.tanker_id,
            driver_id=driver_id,  # Assign driver from trip group assignment
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

    # Validate tanker assignment
    if assignment.tanker_id is not None:
        tanker = db.query(Tanker).filter(Tanker.id == assignment.tanker_id).first()
        if not tanker:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tanker not found",
            )

        customer = db.query(Customer).filter(Customer.id == trip.customer_id).first()

        # Run validation
        validation_service = TripValidationService(db)
        result = validation_service.validate_tanker_assignment(trip, tanker, customer)

        if not result.is_valid:
            error_messages = [f"{e.code}: {e.message}" for e in result.errors]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"validation_errors": error_messages},
            )

        # Check for conflicts
        conflicts = validation_service.check_trip_conflicts(
            tanker_id=assignment.tanker_id,
            schedule_date=trip.daily_schedule.schedule_date,
            start_time=trip.start_time,
            end_time=trip.end_time,
            exclude_trip_id=trip_id,
        )

        if conflicts:
            conflict_times = [f"{c.start_time}-{c.end_time}" for c in conflicts]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Tanker has conflicting trips at: {', '.join(conflict_times)}",
            )

        trip.tanker_id = assignment.tanker_id
        trip.status = TripStatus.SCHEDULED

    if assignment.driver_id is not None:
        trip.driver_id = assignment.driver_id

    db.commit()
    db.refresh(trip)

    return trip


@router.get("/trips/{trip_id}/compatible-tankers")
def get_compatible_tankers(
    trip_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get list of tankers compatible with trip requirements."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    customer = db.query(Customer).filter(Customer.id == trip.customer_id).first()

    validation_service = TripValidationService(db)
    tankers = validation_service.get_compatible_tankers(
        customer=customer,
        fuel_blend_id=trip.fuel_blend_id,
        volume=trip.volume,
    )

    return [
        {
            "id": t.id,
            "name": t.name,
            "max_capacity": t.max_capacity,
            "delivery_type": t.delivery_type.value,
            "status": t.status.value,
        }
        for t in tankers
    ]


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


@router.get("/{schedule_date}/groups")
def get_schedule_by_groups(
    schedule_date: date = Path(..., description="Date in YYYY-MM-DD format"),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    """
    Get the daily schedule organized by trip groups.

    Returns trip groups with their assigned drivers (from weekly assignments)
    and the trips within each group.
    """
    from app.schemas.schedule import (
        TripGroupScheduleItem,
        TripGroupScheduleResponse,
        UnassignedTripsGroup,
        DriverBasicResponse,
    )

    day_of_week = get_day_of_week(schedule_date)
    week_start = get_week_start(schedule_date)

    # Get the schedule
    schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == schedule_date)
        .first()
    )

    # Get all trip groups for this day
    trip_groups = (
        db.query(TripGroup)
        .filter(TripGroup.day_of_week == day_of_week)
        .filter(TripGroup.is_active == True)
        .order_by(TripGroup.name)
        .all()
    )

    # Get weekly driver assignments for this week
    assignments = (
        db.query(WeeklyDriverAssignment)
        .filter(WeeklyDriverAssignment.week_start_date == week_start)
        .all()
    )
    group_to_driver = {a.trip_group_id: a.driver for a in assignments}

    # Build a mapping of template_id to trip_group_id
    template_to_group = {}
    for group in trip_groups:
        for template in group.templates:
            template_to_group[template.id] = group.id

    # If no schedule exists, return empty structure
    if not schedule:
        group_items = []
        for group in trip_groups:
            driver = group_to_driver.get(group.id)
            group_items.append(
                TripGroupScheduleItem(
                    id=group.id,
                    name=group.name,
                    day_of_week=group.day_of_week,
                    day_name=group.day_name,
                    description=group.description,
                    driver=DriverBasicResponse(id=driver.id, name=driver.name) if driver else None,
                    trips=[],
                    earliest_start_time=group.earliest_start_time,
                    latest_end_time=group.latest_end_time,
                    total_volume=0,
                    template_count=len(group.templates),
                )
            )

        return TripGroupScheduleResponse(
            id=None,
            schedule_date=schedule_date,
            day_of_week=day_of_week,
            day_name=get_day_name(day_of_week),
            is_locked=False,
            trip_groups=group_items,
            unassigned_trips=UnassignedTripsGroup(trips=[], total_volume=0),
            summary=ScheduleSummary(
                total_trips=0,
                assigned_trips=0,
                unassigned_trips=0,
                conflict_trips=0,
                total_volume=0,
            ),
            notes=None,
            created_at=None,
        )

    # Group trips by trip group
    trips_by_group = {group.id: [] for group in trip_groups}
    unassigned_trips = []

    for trip in schedule.trips:
        group_id = template_to_group.get(trip.template_id)
        if group_id and group_id in trips_by_group:
            trips_by_group[group_id].append(trip)
        else:
            # Trip not in any group (ad-hoc or orphaned)
            unassigned_trips.append(trip)

    # Build response
    group_items = []
    for group in trip_groups:
        driver = group_to_driver.get(group.id)
        group_trips = trips_by_group.get(group.id, [])

        group_items.append(
            TripGroupScheduleItem(
                id=group.id,
                name=group.name,
                day_of_week=group.day_of_week,
                day_name=group.day_name,
                description=group.description,
                driver=DriverBasicResponse(id=driver.id, name=driver.name) if driver else None,
                trips=group_trips,
                earliest_start_time=group.earliest_start_time,
                latest_end_time=group.latest_end_time,
                total_volume=sum(t.volume for t in group_trips),
                template_count=len(group.templates),
            )
        )

    return TripGroupScheduleResponse(
        id=schedule.id,
        schedule_date=schedule.schedule_date,
        day_of_week=schedule.day_of_week,
        day_name=get_day_name(schedule.day_of_week),
        is_locked=schedule.is_locked,
        trip_groups=group_items,
        unassigned_trips=UnassignedTripsGroup(
            trips=unassigned_trips,
            total_volume=sum(t.volume for t in unassigned_trips),
        ),
        summary=calculate_summary(schedule.trips),
        notes=schedule.notes,
        created_at=schedule.created_at,
    )


@router.post("/{schedule_date}/on-demand", response_model=OnDemandDeliveryResponse)
def create_on_demand_delivery(
    schedule_date: date,
    request: OnDemandDeliveryRequest,
    db: DbSession,
    editor: EditorUser,
):
    """
    Create an on-demand delivery with optional auto-assignment.

    If auto_assign is True, will find a compatible tanker that:
    - Has capacity for the volume
    - Supports the fuel blend
    - Covers the customer's emirate
    - Has no time conflicts
    """
    from app.schemas.schedule import TankerBasicResponse
    from datetime import time as time_type

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

    # Get customer
    customer = db.query(Customer).filter(Customer.id == request.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    # Determine time slot
    start_time = request.preferred_start_time or time_type(8, 0)  # Default 8 AM
    end_time = request.preferred_end_time or time_type(
        start_time.hour + 2, start_time.minute
    )  # Default 2 hour window

    assigned_tanker = None
    assigned_tanker_response = None
    auto_assigned = False
    message = "On-demand delivery created"

    if request.auto_assign:
        # Find compatible tankers
        validation_service = TripValidationService(db)
        compatible_tankers = validation_service.get_compatible_tankers(
            customer=customer,
            fuel_blend_id=request.fuel_blend_id,
            volume=request.volume,
        )

        # Find first tanker with no time conflicts
        for tanker in compatible_tankers:
            conflicts = validation_service.check_trip_conflicts(
                tanker_id=tanker.id,
                schedule_date=schedule_date,
                start_time=start_time,
                end_time=end_time,
            )
            if not conflicts:
                assigned_tanker = tanker
                assigned_tanker_response = TankerBasicResponse(
                    id=tanker.id,
                    name=tanker.name,
                )
                auto_assigned = True
                message = f"On-demand delivery created and assigned to {tanker.name}"
                break

        if not assigned_tanker:
            message = "On-demand delivery created but no compatible tanker available"

    # Create the trip
    trip = Trip(
        daily_schedule_id=schedule.id,
        template_id=None,  # No template for on-demand
        customer_id=customer.id,
        tanker_id=assigned_tanker.id if assigned_tanker else None,
        driver_id=assigned_tanker.default_driver_id if assigned_tanker else None,
        start_time=start_time,
        end_time=end_time,
        fuel_blend_id=request.fuel_blend_id or customer.fuel_blend_id,
        volume=request.volume,
        is_mobile_op=customer.customer_type == "mobile",
        needs_return=False,
        status=TripStatus.SCHEDULED if assigned_tanker else TripStatus.UNASSIGNED,
        notes=request.notes or "On-demand delivery",
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)

    return OnDemandDeliveryResponse(
        trip=trip,
        auto_assigned=auto_assigned,
        assigned_tanker=assigned_tanker_response,
        message=message,
    )
