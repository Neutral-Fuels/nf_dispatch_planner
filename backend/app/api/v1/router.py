"""Main API v1 router."""

from fastapi import APIRouter

from app.api.v1 import auth, users, reference, drivers, tankers, customers, templates, schedules

api_router = APIRouter()

# Include all route modules
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(reference.router, prefix="/reference", tags=["Reference Data"])
api_router.include_router(drivers.router, prefix="/drivers", tags=["Drivers"])
api_router.include_router(tankers.router, prefix="/tankers", tags=["Tankers"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(templates.router, prefix="/templates", tags=["Weekly Templates"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["Schedules"])
