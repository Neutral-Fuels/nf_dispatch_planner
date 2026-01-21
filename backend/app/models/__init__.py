"""SQLAlchemy models for NF Dispatch Planner."""

from app.models.reference import Emirate, FuelBlend
from app.models.user import User
from app.models.driver import Driver, DriverSchedule
from app.models.tanker import Tanker, tanker_blends, tanker_emirates
from app.models.customer import Customer
from app.models.schedule import DailySchedule, Trip, WeeklyTemplate
from app.models.trip_group import TripGroup, WeeklyDriverAssignment, trip_group_templates

__all__ = [
    "Emirate",
    "FuelBlend",
    "User",
    "Driver",
    "DriverSchedule",
    "Tanker",
    "tanker_blends",
    "tanker_emirates",
    "Customer",
    "DailySchedule",
    "Trip",
    "WeeklyTemplate",
    "TripGroup",
    "WeeklyDriverAssignment",
    "trip_group_templates",
]
