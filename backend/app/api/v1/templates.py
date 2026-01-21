"""Weekly template management endpoints."""

from math import ceil
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.schedule import WeeklyTemplate
from app.schemas.schedule import (
    WeeklyTemplateCreate,
    WeeklyTemplateResponse,
    WeeklyTemplatesListResponse,
    WeeklyTemplateUpdate,
)

router = APIRouter()


@router.get("", response_model=WeeklyTemplatesListResponse)
def list_templates(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    day_of_week: Optional[int] = Query(None, ge=0, le=6),
    customer_id: Optional[int] = None,
    is_active: Optional[bool] = True,
):
    """
    List all weekly templates with pagination and filtering.

    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 50, max: 100)
    - **day_of_week**: Filter by day (0=Saturday, 6=Friday)
    - **customer_id**: Filter by customer
    - **is_active**: Filter by active status (default: True)
    """
    query = db.query(WeeklyTemplate)

    # Apply filters
    if day_of_week is not None:
        query = query.filter(WeeklyTemplate.day_of_week == day_of_week)
    if customer_id:
        query = query.filter(WeeklyTemplate.customer_id == customer_id)
    if is_active is not None:
        query = query.filter(WeeklyTemplate.is_active == is_active)

    # Get total count
    total = query.count()

    # Paginate and order by day, then time
    templates = (
        query.order_by(
            WeeklyTemplate.day_of_week,
            WeeklyTemplate.start_time,
            WeeklyTemplate.priority,
        )
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return WeeklyTemplatesListResponse(
        items=templates,
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total > 0 else 1,
    )


@router.get("/day/{day_of_week}", response_model=list[WeeklyTemplateResponse])
def get_templates_by_day(
    day_of_week: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get all templates for a specific day of the week (0=Saturday, 6=Friday)."""
    if day_of_week < 0 or day_of_week > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Day of week must be between 0 (Saturday) and 6 (Friday)",
        )

    templates = (
        db.query(WeeklyTemplate)
        .filter(WeeklyTemplate.day_of_week == day_of_week)
        .filter(WeeklyTemplate.is_active == True)
        .order_by(WeeklyTemplate.start_time, WeeklyTemplate.priority)
        .all()
    )

    return templates


@router.post("", response_model=WeeklyTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    template_data: WeeklyTemplateCreate,
    db: DbSession,
    editor: EditorUser,
):
    """Create a new weekly template."""
    template = WeeklyTemplate(**template_data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)

    return template


@router.get("/{template_id}", response_model=WeeklyTemplateResponse)
def get_template(
    template_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get a specific template by ID."""
    template = db.query(WeeklyTemplate).filter(WeeklyTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    return template


@router.put("/{template_id}", response_model=WeeklyTemplateResponse)
def update_template(
    template_id: int,
    template_data: WeeklyTemplateUpdate,
    db: DbSession,
    editor: EditorUser,
):
    """Update a weekly template."""
    template = db.query(WeeklyTemplate).filter(WeeklyTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    # Update fields
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)

    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: DbSession,
    editor: EditorUser,
):
    """Deactivate a template (soft delete)."""
    template = db.query(WeeklyTemplate).filter(WeeklyTemplate.id == template_id).first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    template.is_active = False
    db.commit()
