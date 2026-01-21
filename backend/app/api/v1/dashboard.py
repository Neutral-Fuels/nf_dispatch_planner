"""Dashboard summary endpoints."""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy import func

from app.api.deps import CurrentUser, DbSession
from app.models.customer import Customer
from app.models.driver import Driver, DriverSchedule, DriverStatus
from app.models.schedule import DailySchedule, Trip, TripStatus
from app.models.tanker import Tanker, TankerStatus

router = APIRouter()


@router.get("/summary")
def get_dashboard_summary(
    db: DbSession,
    current_user: CurrentUser,
    summary_date: Optional[date] = Query(None, description="Date for summary (defaults to today)"),
):
    """
    Get dashboard summary for a specific date.

    Returns:
    - Trip statistics (total, assigned, unassigned, conflicts)
    - Total volume scheduled
    - Active tankers and drivers
    - Alerts for issues
    """
    if summary_date is None:
        summary_date = date.today()

    # Get day's schedule
    schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == summary_date)
        .first()
    )

    if schedule:
        trips = schedule.trips
        total_trips = len(trips)
        assigned_trips = sum(1 for t in trips if t.tanker_id and t.status != TripStatus.CANCELLED)
        unassigned_trips = sum(1 for t in trips if t.tanker_id is None and t.status != TripStatus.CANCELLED)
        conflict_trips = sum(1 for t in trips if t.status == TripStatus.CONFLICT)
        completed_trips = sum(1 for t in trips if t.status == TripStatus.COMPLETED)
        total_volume = sum(t.volume for t in trips if t.status != TripStatus.CANCELLED)
    else:
        total_trips = 0
        assigned_trips = 0
        unassigned_trips = 0
        conflict_trips = 0
        completed_trips = 0
        total_volume = 0

    # Count active resources
    active_tankers = db.query(Tanker).filter(
        Tanker.is_active == True,
        Tanker.status == TankerStatus.ACTIVE,
    ).count()

    active_drivers = db.query(Driver).filter(
        Driver.is_active == True,
    ).count()

    # Get working drivers for the date
    working_drivers = (
        db.query(DriverSchedule)
        .filter(DriverSchedule.schedule_date == summary_date)
        .filter(DriverSchedule.status == DriverStatus.WORKING)
        .count()
    )

    # Generate alerts
    alerts = []

    if unassigned_trips > 0:
        alerts.append({
            "type": "warning",
            "code": "UNASSIGNED_TRIPS",
            "message": f"{unassigned_trips} trips need tanker assignment",
            "count": unassigned_trips,
        })

    if conflict_trips > 0:
        alerts.append({
            "type": "error",
            "code": "TRIP_CONFLICTS",
            "message": f"{conflict_trips} trips have scheduling conflicts",
            "count": conflict_trips,
        })

    # Check for tankers in maintenance
    maintenance_tankers = db.query(Tanker).filter(
        Tanker.status == TankerStatus.MAINTENANCE,
    ).count()

    if maintenance_tankers > 0:
        alerts.append({
            "type": "info",
            "code": "TANKERS_MAINTENANCE",
            "message": f"{maintenance_tankers} tankers in maintenance",
            "count": maintenance_tankers,
        })

    return {
        "date": summary_date.isoformat(),
        "trips": {
            "total": total_trips,
            "assigned": assigned_trips,
            "unassigned": unassigned_trips,
            "conflicts": conflict_trips,
            "completed": completed_trips,
        },
        "volume": {
            "total_scheduled": total_volume,
        },
        "resources": {
            "active_tankers": active_tankers,
            "active_drivers": active_drivers,
            "working_drivers": working_drivers,
        },
        "alerts": alerts,
        "schedule_locked": schedule.is_locked if schedule else False,
    }


@router.get("/tanker-utilization")
def get_tanker_utilization(
    db: DbSession,
    current_user: CurrentUser,
    summary_date: Optional[date] = Query(None),
):
    """
    Get tanker utilization statistics for a date.

    Returns volume scheduled per tanker.
    """
    if summary_date is None:
        summary_date = date.today()

    # Get all active tankers
    tankers = (
        db.query(Tanker)
        .filter(Tanker.is_active == True)
        .order_by(Tanker.name)
        .all()
    )

    # Get schedule for the date
    schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == summary_date)
        .first()
    )

    utilization = []
    for tanker in tankers:
        if schedule:
            trips = [t for t in schedule.trips if t.tanker_id == tanker.id and t.status != TripStatus.CANCELLED]
            trip_count = len(trips)
            volume_scheduled = sum(t.volume for t in trips)
        else:
            trip_count = 0
            volume_scheduled = 0

        utilization_percent = (volume_scheduled / tanker.max_capacity * 100) if tanker.max_capacity > 0 else 0

        utilization.append({
            "tanker_id": tanker.id,
            "tanker_name": tanker.name,
            "max_capacity": tanker.max_capacity,
            "volume_scheduled": volume_scheduled,
            "trip_count": trip_count,
            "utilization_percent": round(utilization_percent, 1),
            "status": tanker.status.value,
        })

    return {
        "date": summary_date.isoformat(),
        "tankers": utilization,
    }


@router.get("/driver-status")
def get_driver_status(
    db: DbSession,
    current_user: CurrentUser,
    summary_date: Optional[date] = Query(None),
):
    """
    Get driver status summary for a date.

    Returns count of drivers by status (working, off, holiday, float).
    """
    if summary_date is None:
        summary_date = date.today()

    # Get all active drivers
    drivers = (
        db.query(Driver)
        .filter(Driver.is_active == True)
        .all()
    )

    # Get schedules for the date
    schedules = (
        db.query(DriverSchedule)
        .filter(DriverSchedule.schedule_date == summary_date)
        .all()
    )

    schedule_map = {s.driver_id: s.status for s in schedules}

    status_counts = {
        "working": 0,
        "off": 0,
        "holiday": 0,
        "float": 0,
        "unset": 0,
    }

    driver_list = []
    for driver in drivers:
        status = schedule_map.get(driver.id)
        if status:
            status_counts[status.value] += 1
            driver_list.append({
                "id": driver.id,
                "name": driver.name,
                "status": status.value,
            })
        else:
            status_counts["unset"] += 1
            driver_list.append({
                "id": driver.id,
                "name": driver.name,
                "status": "unset",
            })

    return {
        "date": summary_date.isoformat(),
        "summary": status_counts,
        "drivers": driver_list,
    }


@router.get("/weekly-overview")
def get_weekly_overview(
    db: DbSession,
    current_user: CurrentUser,
    start_date: Optional[date] = Query(None, description="Start of week (defaults to current week's Saturday)"),
):
    """
    Get overview for an entire week.

    Returns trip counts and volume for each day of the week.
    """
    if start_date is None:
        # Find the most recent Saturday
        today = date.today()
        days_since_saturday = (today.weekday() + 2) % 7
        start_date = today - timedelta(days=days_since_saturday)

    days = []
    day_names = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    for i in range(7):
        current_date = start_date + timedelta(days=i)

        schedule = (
            db.query(DailySchedule)
            .filter(DailySchedule.schedule_date == current_date)
            .first()
        )

        if schedule:
            trips = [t for t in schedule.trips if t.status != TripStatus.CANCELLED]
            total_trips = len(trips)
            assigned_trips = sum(1 for t in trips if t.tanker_id)
            total_volume = sum(t.volume for t in trips)
            is_locked = schedule.is_locked
        else:
            total_trips = 0
            assigned_trips = 0
            total_volume = 0
            is_locked = False

        days.append({
            "date": current_date.isoformat(),
            "day_name": day_names[i],
            "total_trips": total_trips,
            "assigned_trips": assigned_trips,
            "unassigned_trips": total_trips - assigned_trips,
            "total_volume": total_volume,
            "is_locked": is_locked,
        })

    return {
        "week_start": start_date.isoformat(),
        "week_end": (start_date + timedelta(days=6)).isoformat(),
        "days": days,
    }


@router.get("/alerts")
def get_alerts(
    db: DbSession,
    current_user: CurrentUser,
    summary_date: Optional[date] = Query(None),
):
    """
    Get all alerts for a specific date.

    Returns detailed alerts for:
    - Unassigned trips
    - Conflicting trips
    - Drivers without schedule
    - Tankers in maintenance
    """
    if summary_date is None:
        summary_date = date.today()

    alerts = []

    # Get schedule
    schedule = (
        db.query(DailySchedule)
        .filter(DailySchedule.schedule_date == summary_date)
        .first()
    )

    if schedule:
        # Unassigned trips
        unassigned = [t for t in schedule.trips if t.tanker_id is None and t.status != TripStatus.CANCELLED]
        for trip in unassigned:
            alerts.append({
                "type": "warning",
                "code": "UNASSIGNED_TRIP",
                "message": f"Trip to {trip.customer.name} ({trip.start_time}-{trip.end_time}) needs tanker",
                "trip_id": trip.id,
                "customer_code": trip.customer.code,
            })

        # Conflict trips
        conflicts = [t for t in schedule.trips if t.status == TripStatus.CONFLICT]
        for trip in conflicts:
            alerts.append({
                "type": "error",
                "code": "TRIP_CONFLICT",
                "message": f"Trip to {trip.customer.name} has a scheduling conflict",
                "trip_id": trip.id,
                "customer_code": trip.customer.code,
            })

    # Tankers in maintenance
    maintenance = db.query(Tanker).filter(Tanker.status == TankerStatus.MAINTENANCE).all()
    for tanker in maintenance:
        alerts.append({
            "type": "info",
            "code": "TANKER_MAINTENANCE",
            "message": f"Tanker {tanker.name} is in maintenance",
            "tanker_id": tanker.id,
        })

    # Drivers without schedule
    drivers = db.query(Driver).filter(Driver.is_active == True).all()
    scheduled_driver_ids = {
        s.driver_id for s in
        db.query(DriverSchedule).filter(DriverSchedule.schedule_date == summary_date).all()
    }

    for driver in drivers:
        if driver.id not in scheduled_driver_ids:
            alerts.append({
                "type": "info",
                "code": "DRIVER_NO_SCHEDULE",
                "message": f"Driver {driver.name} has no schedule set for this date",
                "driver_id": driver.id,
            })

    return {
        "date": summary_date.isoformat(),
        "total_alerts": len(alerts),
        "alerts": alerts,
    }
