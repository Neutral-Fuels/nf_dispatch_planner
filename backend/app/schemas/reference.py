"""Reference data schemas."""

from pydantic import BaseModel


class EmirateResponse(BaseModel):
    """Emirate response schema."""

    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


class FuelBlendResponse(BaseModel):
    """Fuel blend response schema."""

    id: int
    code: str
    name: str
    biodiesel_percentage: int

    class Config:
        from_attributes = True
