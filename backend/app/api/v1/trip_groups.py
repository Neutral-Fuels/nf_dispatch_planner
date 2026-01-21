"""Trip group management endpoints."""

from math import ceil
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.schedule import WeeklyTemplate
from app.models.trip_group import TripGroup, trip_group_templates
from app.schemas.trip_group import (
    AddTemplateRequest,
    RemoveTemplateRequest,
    TripGroupCreate,
    TripGroupListResponse,
    TripGroupResponse,
    TripGroupsListResponse,
    TripGroupUpdate,
)

router = APIRouter()


@router.get("", response_model=TripGroupsListResponse)
def list_trip_groups(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
    day_of_week: Optional[int] = Query(None, ge=0, le=6, description="Filter by day (0=Saturday, 6=Friday)"),
):
    """
    List all trip groups with pagination and filtering.

    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 50, max: 100)
    - **is_active**: Filter by active status (default: True)
    - **search**: Search by name
    - **day_of_week**: Filter by day of week (0=Saturday to 6=Friday)
    """
    query = db.query(TripGroup)

    # Apply filters
    if is_active is not None:
        query = query.filter(TripGroup.is_active == is_active)
    if search:
        query = query.filter(TripGroup.name.ilike(f"%{search}%"))
    if day_of_week is not None:
        query = query.filter(TripGroup.day_of_week == day_of_week)

    # Get total count
    total = query.count()

    # Paginate and order by day_of_week, then name
    groups = (
        query.order_by(TripGroup.day_of_week, TripGroup.name)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Build response with template counts and time calculations
    items = []
    for group in groups:
        items.append(
            TripGroupListResponse(
                id=group.id,
                name=group.name,
                day_of_week=group.day_of_week,
                day_name=group.day_name,
                description=group.description,
                is_active=group.is_active,
                template_count=len(group.templates),
                template_ids=[t.id for t in group.templates],
                earliest_start_time=group.earliest_start_time,
                latest_end_time=group.latest_end_time,
                total_duration_minutes=group.total_duration_minutes,
                total_volume=group.total_volume,
                created_at=group.created_at,
            )
        )

    return TripGroupsListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total > 0 else 1,
    )


@router.post("", response_model=TripGroupResponse, status_code=status.HTTP_201_CREATED)
def create_trip_group(
    group_data: TripGroupCreate,
    db: DbSession,
    editor: EditorUser,
):
    """Create a new trip group for a specific day with optional templates."""
    # Create the group
    group = TripGroup(
        name=group_data.name,
        day_of_week=group_data.day_of_week,
        description=group_data.description,
    )
    db.add(group)
    db.flush()

    # Add templates if provided (must be for the same day)
    if group_data.template_ids:
        templates = (
            db.query(WeeklyTemplate)
            .filter(WeeklyTemplate.id.in_(group_data.template_ids))
            .filter(WeeklyTemplate.day_of_week == group_data.day_of_week)
            .all()
        )
        if len(templates) != len(group_data.template_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Some templates are not valid for {group.day_name}",
            )
        group.templates = templates

    db.commit()
    db.refresh(group)

    return TripGroupResponse(
        id=group.id,
        name=group.name,
        day_of_week=group.day_of_week,
        day_name=group.day_name,
        description=group.description,
        is_active=group.is_active,
        templates=group.templates,
        template_count=len(group.templates),
        earliest_start_time=group.earliest_start_time,
        latest_end_time=group.latest_end_time,
        total_duration_minutes=group.total_duration_minutes,
        total_volume=group.total_volume,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.get("/{group_id}", response_model=TripGroupResponse)
def get_trip_group(
    group_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get a specific trip group by ID with full template details."""
    group = db.query(TripGroup).filter(TripGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip group not found",
        )

    return TripGroupResponse(
        id=group.id,
        name=group.name,
        day_of_week=group.day_of_week,
        day_name=group.day_name,
        description=group.description,
        is_active=group.is_active,
        templates=group.templates,
        template_count=len(group.templates),
        earliest_start_time=group.earliest_start_time,
        latest_end_time=group.latest_end_time,
        total_duration_minutes=group.total_duration_minutes,
        total_volume=group.total_volume,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.put("/{group_id}", response_model=TripGroupResponse)
def update_trip_group(
    group_id: int,
    group_data: TripGroupUpdate,
    db: DbSession,
    editor: EditorUser,
):
    """Update a trip group (note: day_of_week cannot be changed)."""
    group = db.query(TripGroup).filter(TripGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip group not found",
        )

    # Update fields
    update_data = group_data.model_dump(exclude_unset=True)

    # Handle template_ids separately (must be for same day)
    template_ids = update_data.pop("template_ids", None)
    if template_ids is not None:
        templates = (
            db.query(WeeklyTemplate)
            .filter(WeeklyTemplate.id.in_(template_ids))
            .filter(WeeklyTemplate.day_of_week == group.day_of_week)
            .all()
        )
        if len(templates) != len(template_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Some templates are not valid for {group.day_name}",
            )
        group.templates = templates

    # Update other fields
    for field, value in update_data.items():
        setattr(group, field, value)

    db.commit()
    db.refresh(group)

    return TripGroupResponse(
        id=group.id,
        name=group.name,
        day_of_week=group.day_of_week,
        day_name=group.day_name,
        description=group.description,
        is_active=group.is_active,
        templates=group.templates,
        template_count=len(group.templates),
        earliest_start_time=group.earliest_start_time,
        latest_end_time=group.latest_end_time,
        total_duration_minutes=group.total_duration_minutes,
        total_volume=group.total_volume,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip_group(
    group_id: int,
    db: DbSession,
    editor: EditorUser,
):
    """Deactivate a trip group (soft delete)."""
    group = db.query(TripGroup).filter(TripGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip group not found",
        )

    group.is_active = False
    db.commit()


@router.post("/{group_id}/templates", response_model=TripGroupResponse)
def add_templates_to_group(
    group_id: int,
    request: AddTemplateRequest,
    db: DbSession,
    editor: EditorUser,
):
    """Add templates to a trip group (templates must be for the same day)."""
    group = db.query(TripGroup).filter(TripGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip group not found",
        )

    # Get existing template IDs
    existing_ids = {t.id for t in group.templates}

    # Get new templates (must be for the same day as the group)
    new_templates = (
        db.query(WeeklyTemplate)
        .filter(WeeklyTemplate.id.in_(request.template_ids))
        .filter(WeeklyTemplate.day_of_week == group.day_of_week)
        .filter(~WeeklyTemplate.id.in_(existing_ids))
        .all()
    )

    # Validate all requested templates were found and are for the right day
    found_ids = {t.id for t in new_templates}
    requested_new_ids = set(request.template_ids) - existing_ids
    if found_ids != requested_new_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Some templates are not valid for {group.day_name}",
        )

    # Add to group
    group.templates.extend(new_templates)
    db.commit()
    db.refresh(group)

    return TripGroupResponse(
        id=group.id,
        name=group.name,
        day_of_week=group.day_of_week,
        day_name=group.day_name,
        description=group.description,
        is_active=group.is_active,
        templates=group.templates,
        template_count=len(group.templates),
        earliest_start_time=group.earliest_start_time,
        latest_end_time=group.latest_end_time,
        total_duration_minutes=group.total_duration_minutes,
        total_volume=group.total_volume,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.delete("/{group_id}/templates/{template_id}", response_model=TripGroupResponse)
def remove_template_from_group(
    group_id: int,
    template_id: int,
    db: DbSession,
    editor: EditorUser,
):
    """Remove a template from a trip group."""
    group = db.query(TripGroup).filter(TripGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip group not found",
        )

    # Find and remove the template
    group.templates = [t for t in group.templates if t.id != template_id]
    db.commit()
    db.refresh(group)

    return TripGroupResponse(
        id=group.id,
        name=group.name,
        day_of_week=group.day_of_week,
        day_name=group.day_name,
        description=group.description,
        is_active=group.is_active,
        templates=group.templates,
        template_count=len(group.templates),
        earliest_start_time=group.earliest_start_time,
        latest_end_time=group.latest_end_time,
        total_duration_minutes=group.total_duration_minutes,
        total_volume=group.total_volume,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.post("/{group_id}/templates/remove", response_model=TripGroupResponse)
def remove_templates_from_group(
    group_id: int,
    request: RemoveTemplateRequest,
    db: DbSession,
    editor: EditorUser,
):
    """Remove multiple templates from a trip group."""
    group = db.query(TripGroup).filter(TripGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip group not found",
        )

    # Remove specified templates
    remove_ids = set(request.template_ids)
    group.templates = [t for t in group.templates if t.id not in remove_ids]
    db.commit()
    db.refresh(group)

    return TripGroupResponse(
        id=group.id,
        name=group.name,
        day_of_week=group.day_of_week,
        day_name=group.day_name,
        description=group.description,
        is_active=group.is_active,
        templates=group.templates,
        template_count=len(group.templates),
        earliest_start_time=group.earliest_start_time,
        latest_end_time=group.latest_end_time,
        total_duration_minutes=group.total_duration_minutes,
        total_volume=group.total_volume,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )
