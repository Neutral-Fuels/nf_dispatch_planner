"""Audit logging service."""

import json
import logging
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import Session

from app.database import Base


class AuditAction(str, Enum):
    """Audit action types."""

    # Authentication
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_CHANGED = "password_changed"

    # User management
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DEACTIVATED = "user_deactivated"
    USER_ACTIVATED = "user_activated"

    # Driver management
    DRIVER_CREATED = "driver_created"
    DRIVER_UPDATED = "driver_updated"
    DRIVER_DEACTIVATED = "driver_deactivated"

    # Tanker management
    TANKER_CREATED = "tanker_created"
    TANKER_UPDATED = "tanker_updated"
    TANKER_DEACTIVATED = "tanker_deactivated"

    # Customer management
    CUSTOMER_CREATED = "customer_created"
    CUSTOMER_UPDATED = "customer_updated"
    CUSTOMER_DEACTIVATED = "customer_deactivated"

    # Schedule management
    SCHEDULE_GENERATED = "schedule_generated"
    SCHEDULE_LOCKED = "schedule_locked"
    SCHEDULE_UNLOCKED = "schedule_unlocked"
    TRIP_CREATED = "trip_created"
    TRIP_UPDATED = "trip_updated"
    TRIP_ASSIGNED = "trip_assigned"
    TRIP_DELETED = "trip_deleted"

    # Template management
    TEMPLATE_CREATED = "template_created"
    TEMPLATE_UPDATED = "template_updated"
    TEMPLATE_DEACTIVATED = "template_deactivated"

    # Driver schedule
    DRIVER_SCHEDULE_SET = "driver_schedule_set"
    DRIVER_SCHEDULE_BULK = "driver_schedule_bulk"


class AuditLog(Base):
    """Audit log database model."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    username = Column(String(100), nullable=True)
    action = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=True, index=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)


class AuditService:
    """Service for audit logging."""

    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger("audit")

    def log(
        self,
        action: AuditAction,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """
        Create an audit log entry.

        Args:
            action: The action being logged
            user_id: ID of the user performing the action
            username: Username of the user
            entity_type: Type of entity being modified (e.g., "user", "driver")
            entity_id: ID of the entity being modified
            details: Additional details as a dictionary
            ip_address: Client IP address
            user_agent: Client user agent string
        """
        # Create database entry
        audit_log = AuditLog(
            user_id=user_id,
            username=username,
            action=action.value,
            entity_type=entity_type,
            entity_id=entity_id,
            details=json.dumps(details) if details else None,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
        )

        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)

        # Also log to file/stdout
        self.logger.info(
            f"AUDIT: {action.value} | user={username or user_id} | "
            f"entity={entity_type}:{entity_id} | ip={ip_address}"
        )

        return audit_log

    def get_logs(
        self,
        action: Optional[AuditAction] = None,
        user_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditLog]:
        """Query audit logs with filters."""
        query = self.db.query(AuditLog)

        if action:
            query = query.filter(AuditLog.action == action.value)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if entity_id:
            query = query.filter(AuditLog.entity_id == entity_id)
        if start_date:
            query = query.filter(AuditLog.timestamp >= start_date)
        if end_date:
            query = query.filter(AuditLog.timestamp <= end_date)

        return (
            query.order_by(AuditLog.timestamp.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )


def create_audit_log(
    db: Session,
    action: AuditAction,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """Convenience function to create an audit log."""
    service = AuditService(db)
    return service.log(
        action=action,
        user_id=user_id,
        username=username,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
