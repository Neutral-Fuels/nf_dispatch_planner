"""Reference data endpoints (Emirates, Fuel Blends)."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.models.reference import Emirate, FuelBlend
from app.schemas.reference import EmirateResponse, FuelBlendResponse

router = APIRouter()


@router.get("/emirates", response_model=list[EmirateResponse])
def list_emirates(db: DbSession, current_user: CurrentUser):
    """Get all emirates."""
    return db.query(Emirate).filter(Emirate.is_active == True).all()


@router.get("/fuel-blends", response_model=list[FuelBlendResponse])
def list_fuel_blends(db: DbSession, current_user: CurrentUser):
    """Get all fuel blends."""
    return db.query(FuelBlend).filter(FuelBlend.is_active == True).all()
