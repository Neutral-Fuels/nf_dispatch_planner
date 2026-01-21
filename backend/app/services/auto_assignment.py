"""Auto-assignment service for weekly driver assignments."""

import random
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.driver import Driver, DriverSchedule, DriverStatus
from app.models.trip_group import TripGroup, WeeklyDriverAssignment
from app.schemas.trip_group import (
    AutoAssignmentPreview,
    AutoAssignResponse,
    DriverBasicResponse,
    TripGroupBasicResponse,
    WeeklyDriverAssignmentResponse,
)


class AutoAssignmentService:
    """Service for automatically assigning drivers to trip groups."""

    def __init__(self, db: Session):
        self.db = db

    def auto_assign(
        self,
        week_start: date,
        user_id: int,
        min_rest_hours: int = 12,
        dry_run: bool = False,
    ) -> AutoAssignResponse:
        """
        Auto-assign drivers to trip groups for a week.

        Args:
            week_start: The Saturday starting the week
            user_id: ID of user performing the assignment
            min_rest_hours: Minimum rest hours between end of day N and start of day N+1
            dry_run: If True, return preview without creating assignments

        Returns:
            AutoAssignResponse with results
        """
        # Get all active trip groups with templates
        trip_groups = (
            self.db.query(TripGroup)
            .filter(TripGroup.is_active == True)
            .all()
        )

        # Get existing assignments for this week (to avoid reassigning)
        existing_assignments = (
            self.db.query(WeeklyDriverAssignment)
            .filter(WeeklyDriverAssignment.week_start_date == week_start)
            .all()
        )
        already_assigned_group_ids = {a.trip_group_id for a in existing_assignments}
        already_assigned_driver_ids = {a.driver_id for a in existing_assignments}

        # Filter to unassigned groups
        unassigned_groups = [
            g for g in trip_groups
            if g.id not in already_assigned_group_ids
        ]

        # Get week's date range (Saturday to Friday)
        week_dates = [week_start + timedelta(days=i) for i in range(7)]

        # Get drivers who are WORKING for the full week
        available_drivers = self._get_available_drivers(week_dates)

        # Filter out already assigned drivers
        available_drivers = [
            d for d in available_drivers
            if d.id not in already_assigned_driver_ids
        ]

        # Perform assignments
        assignments_created = []
        unassigned_results = []
        assigned_driver_ids = set(already_assigned_driver_ids)

        for group in unassigned_groups:
            # Get eligible drivers for this group
            eligible_drivers = [
                d for d in available_drivers
                if d.id not in assigned_driver_ids
                and self._check_rest_gap(group, min_rest_hours)
            ]

            if eligible_drivers:
                # Random selection
                driver = random.choice(eligible_drivers)
                assigned_driver_ids.add(driver.id)

                if not dry_run:
                    # Create the assignment
                    assignment = WeeklyDriverAssignment(
                        trip_group_id=group.id,
                        driver_id=driver.id,
                        week_start_date=week_start,
                        assigned_by=user_id,
                    )
                    self.db.add(assignment)
                    self.db.flush()
                    self.db.refresh(assignment)
                    assignments_created.append(assignment)
                else:
                    # Create preview
                    assignments_created.append(
                        WeeklyDriverAssignmentResponse(
                            id=0,  # Placeholder for dry run
                            trip_group=TripGroupBasicResponse(
                                id=group.id,
                                name=group.name,
                                description=group.description,
                            ),
                            driver=DriverBasicResponse(id=driver.id, name=driver.name),
                            week_start_date=week_start,
                            assigned_at=datetime.utcnow(),
                            assigned_by_user=None,
                            notes=None,
                        )
                    )
            else:
                # No eligible driver found
                reason = "No available drivers"
                if not available_drivers:
                    reason = "All drivers are already assigned or unavailable"
                elif not eligible_drivers:
                    reason = "Remaining drivers do not meet rest gap requirements"

                unassigned_results.append(
                    AutoAssignmentPreview(
                        trip_group=TripGroupBasicResponse(
                            id=group.id,
                            name=group.name,
                            description=group.description,
                        ),
                        driver=None,
                        reason=reason,
                    )
                )

        if not dry_run:
            self.db.commit()

        # Build message
        total_groups = len(unassigned_groups)
        assigned_count = len(assignments_created)
        unassigned_count = len(unassigned_results)

        if assigned_count == total_groups:
            message = f"Successfully assigned all {assigned_count} trip groups"
        elif assigned_count > 0:
            message = f"Assigned {assigned_count} of {total_groups} groups. {unassigned_count} groups could not be assigned."
        else:
            message = "No groups could be assigned - check driver availability and schedules"

        if dry_run:
            message = f"[DRY RUN] {message}"

        return AutoAssignResponse(
            week_start_date=week_start,
            assignments_created=assigned_count,
            groups_unassigned=unassigned_count,
            assignments=assignments_created,
            unassigned=unassigned_results,
            message=message,
        )

    def _get_available_drivers(self, week_dates: list[date]) -> list[Driver]:
        """
        Get drivers who are marked as WORKING for all days in the week.

        Args:
            week_dates: List of dates in the week

        Returns:
            List of available drivers
        """
        # Get all active drivers
        all_drivers = (
            self.db.query(Driver)
            .filter(Driver.is_active == True)
            .all()
        )

        available_drivers = []

        for driver in all_drivers:
            # Get schedules for this driver for the week
            schedules = (
                self.db.query(DriverSchedule)
                .filter(DriverSchedule.driver_id == driver.id)
                .filter(DriverSchedule.schedule_date.in_(week_dates))
                .all()
            )

            # Build a map of date -> status
            schedule_map = {s.schedule_date: s.status for s in schedules}

            # Check if driver is available for all days
            # A driver is available if they have WORKING status for all weekdays (Sat-Thu)
            # Friday can be off
            is_available = True
            for i, d in enumerate(week_dates[:6]):  # Sat-Thu (indices 0-5)
                status = schedule_map.get(d)
                # If no schedule set, assume unavailable (safer default)
                if status is None or status != DriverStatus.WORKING:
                    is_available = False
                    break

            if is_available:
                available_drivers.append(driver)

        return available_drivers

    def _check_rest_gap(
        self,
        group: TripGroup,
        min_rest_hours: int,
    ) -> bool:
        """
        Check if a trip group's schedule allows for minimum rest gap.

        For consecutive days in the group:
        - End time of day N to start time of day N+1 must be >= min_rest_hours

        Args:
            group: The trip group to check
            min_rest_hours: Minimum required rest hours

        Returns:
            True if rest gap is sufficient
        """
        # Group templates by day of week
        templates_by_day = defaultdict(list)
        for template in group.templates:
            if template.is_active:
                templates_by_day[template.day_of_week].append(template)

        # Check consecutive days
        for day in range(6):  # 0 (Sat) to 5 (Thu)
            next_day = day + 1

            if day in templates_by_day and next_day in templates_by_day:
                # Get latest end time for current day
                today_end = max(t.end_time for t in templates_by_day[day])

                # Get earliest start time for next day
                tomorrow_start = min(t.start_time for t in templates_by_day[next_day])

                # Calculate gap
                gap_hours = self._calculate_hours_between(today_end, tomorrow_start)

                if gap_hours < min_rest_hours:
                    return False

        return True

    def _calculate_hours_between(self, end_time: time, start_time: time) -> float:
        """
        Calculate hours between end time and next day's start time.

        Assumes end_time is on day N and start_time is on day N+1.

        Args:
            end_time: End time on day N
            start_time: Start time on day N+1

        Returns:
            Number of hours between the times
        """
        # Convert to minutes since midnight
        end_minutes = end_time.hour * 60 + end_time.minute
        start_minutes = start_time.hour * 60 + start_time.minute

        # Calculate gap (next day, so add 24 hours worth of minutes)
        # Gap = (24:00 - end_time) + start_time
        gap_minutes = (24 * 60 - end_minutes) + start_minutes

        return gap_minutes / 60.0
