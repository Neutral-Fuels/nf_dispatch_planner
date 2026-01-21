"""Weekly driver assignment endpoints."""

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.driver import Driver, DriverSchedule, DriverStatus
from app.models.trip_group import TripGroup, WeeklyDriverAssignment
from app.schemas.trip_group import (
    AutoAssignRequest,
    AutoAssignResponse,
    AutoAssignmentPreview,
    DriverBasicResponse,
    TripGroupBasicResponse,
    WeeklyAssignmentsListResponse,
    WeeklyDriverAssignmentCreate,
    WeeklyDriverAssignmentResponse,
    WeeklyDriverAssignmentUpdate,
)
from app.services.auto_assignment import AutoAssignmentService

router = APIRouter()


def get_week_start(d: date) -> date:
    """Get the Saturday that starts the week containing the given date."""
    # In UAE week, Saturday = 0, Friday = 6
    # Python weekday: Monday = 0, Saturday = 5, Sunday = 6
    # We need to find the previous Saturday
    days_since_saturday = (d.weekday() + 2) % 7  # Convert to UAE week
    return d - timedelta(days=days_since_saturday)


@router.get("", response_model=WeeklyAssignmentsListResponse)
def get_weekly_assignments(
    db: DbSession,
    current_user: CurrentUser,
    week_start: date = Query(..., description="The Saturday starting the week (YYYY-MM-DD)"),
):
    """
    Get all driver assignments for a specific week.

    Returns assignments, unassigned groups, and available drivers.
    """
    # Normalize to week start (Saturday)
    actual_week_start = get_week_start(week_start)

    # Get assignments for this week
    assignments = (
        db.query(WeeklyDriverAssignment)
        .filter(WeeklyDriverAssignment.week_start_date == actual_week_start)
        .all()
    )

    # Get all active trip groups
    all_groups = db.query(TripGroup).filter(TripGroup.is_active == True).all()

    # Find assigned group IDs
    assigned_group_ids = {a.trip_group_id for a in assignments}

    # Find unassigned groups
    unassigned_groups = [g for g in all_groups if g.id not in assigned_group_ids]

    # Find assigned driver IDs
    assigned_driver_ids = {a.driver_id for a in assignments}

    # Get all active drivers who are not assigned
    available_drivers = (
        db.query(Driver)
        .filter(Driver.is_active == True)
        .filter(~Driver.id.in_(assigned_driver_ids) if assigned_driver_ids else True)
        .order_by(Driver.name)
        .all()
    )

    return WeeklyAssignmentsListResponse(
        week_start_date=actual_week_start,
        assignments=assignments,
        unassigned_groups=[
            TripGroupBasicResponse(
                id=g.id,
                name=g.name,
                day_of_week=g.day_of_week,
                day_name=g.day_name,
                description=g.description
            )
            for g in unassigned_groups
        ],
        available_drivers=[
            DriverBasicResponse(id=d.id, name=d.name)
            for d in available_drivers
        ],
    )


@router.post("", response_model=WeeklyDriverAssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    assignment_data: WeeklyDriverAssignmentCreate,
    db: DbSession,
    editor: EditorUser,
):
    """
    Manually create a driver assignment for a week.

    Note: Each driver can only be assigned to one trip group per week,
    and each trip group can only have one driver per week.
    """
    # Normalize to week start (Saturday)
    week_start = get_week_start(assignment_data.week_start_date)

    # Verify trip group exists and is active
    group = db.query(TripGroup).filter(TripGroup.id == assignment_data.trip_group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip group not found",
        )
    if not group.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip group is not active",
        )

    # Verify driver exists and is active
    driver = db.query(Driver).filter(Driver.id == assignment_data.driver_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )
    if not driver.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver is not active",
        )

    # Create assignment
    assignment = WeeklyDriverAssignment(
        trip_group_id=assignment_data.trip_group_id,
        driver_id=assignment_data.driver_id,
        week_start_date=week_start,
        assigned_by=editor.id,
        notes=assignment_data.notes,
    )

    try:
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This driver or trip group is already assigned for this week",
        )

    return assignment


@router.put("/{assignment_id}", response_model=WeeklyDriverAssignmentResponse)
def update_assignment(
    assignment_id: int,
    assignment_data: WeeklyDriverAssignmentUpdate,
    db: DbSession,
    editor: EditorUser,
):
    """Update an existing assignment (change driver or notes)."""
    assignment = (
        db.query(WeeklyDriverAssignment)
        .filter(WeeklyDriverAssignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    # Update fields
    update_data = assignment_data.model_dump(exclude_unset=True)

    # Verify new driver if changing
    if "driver_id" in update_data:
        driver = db.query(Driver).filter(Driver.id == update_data["driver_id"]).first()
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Driver not found",
            )
        if not driver.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Driver is not active",
            )

    for field, value in update_data.items():
        setattr(assignment, field, value)

    try:
        db.commit()
        db.refresh(assignment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This driver is already assigned to another group this week",
        )

    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: int,
    db: DbSession,
    editor: EditorUser,
):
    """Delete an assignment."""
    assignment = (
        db.query(WeeklyDriverAssignment)
        .filter(WeeklyDriverAssignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    db.delete(assignment)
    db.commit()


@router.post("/auto-assign", response_model=AutoAssignResponse)
def auto_assign_drivers(
    request: AutoAssignRequest,
    db: DbSession,
    editor: EditorUser,
):
    """
    Automatically assign drivers to trip groups for a week.

    Rules:
    - Each driver gets ONE trip group for the whole week
    - Must have minimum rest gap between end of one day and start of next
    - Only assign to drivers marked WORKING for all days in the group
    - Random selection among eligible drivers
    - If dry_run=true, returns preview without creating assignments
    """
    # Normalize to week start (Saturday)
    week_start = get_week_start(request.week_start_date)

    # Initialize service
    service = AutoAssignmentService(db)

    # Run auto-assignment
    result = service.auto_assign(
        week_start=week_start,
        user_id=editor.id,
        min_rest_hours=request.min_rest_hours,
        dry_run=request.dry_run,
    )

    return result


@router.delete("/week/{week_start}", status_code=status.HTTP_204_NO_CONTENT)
def clear_week_assignments(
    week_start: date,
    db: DbSession,
    editor: EditorUser,
):
    """Clear all assignments for a specific week."""
    actual_week_start = get_week_start(week_start)

    db.query(WeeklyDriverAssignment).filter(
        WeeklyDriverAssignment.week_start_date == actual_week_start
    ).delete()

    db.commit()
