"""Trip and schedule validation service."""

from dataclasses import dataclass
from datetime import time
from typing import Optional

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.schedule import Trip, TripStatus
from app.models.tanker import Tanker


@dataclass
class ValidationError:
    """Validation error details."""

    code: str
    message: str
    field: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of validation check."""

    is_valid: bool
    errors: list[ValidationError]
    warnings: list[ValidationError]

    @classmethod
    def success(cls) -> "ValidationResult":
        return cls(is_valid=True, errors=[], warnings=[])

    @classmethod
    def failure(cls, errors: list[ValidationError], warnings: list[ValidationError] = None) -> "ValidationResult":
        return cls(is_valid=False, errors=errors, warnings=warnings or [])


class TripValidationService:
    """Service for validating trip assignments."""

    def __init__(self, db: Session):
        self.db = db

    def validate_tanker_assignment(
        self,
        trip: Trip,
        tanker: Tanker,
        customer: Customer,
    ) -> ValidationResult:
        """
        Validate that a tanker can be assigned to a trip.

        Checks:
        - Tanker capacity >= trip volume
        - Tanker supports required fuel blend
        - Tanker covers customer's emirate
        - Tanker delivery type matches customer type
        """
        errors = []
        warnings = []

        # Check capacity
        if tanker.max_capacity < trip.volume:
            errors.append(ValidationError(
                code="INSUFFICIENT_CAPACITY",
                message=f"Tanker capacity ({tanker.max_capacity}L) is less than trip volume ({trip.volume}L)",
                field="tanker_id",
            ))

        # Check fuel blend compatibility
        if trip.fuel_blend_id:
            if not tanker.supports_blend(trip.fuel_blend_id):
                blend_names = ", ".join(b.code for b in tanker.fuel_blends)
                errors.append(ValidationError(
                    code="INCOMPATIBLE_FUEL_BLEND",
                    message=f"Tanker only supports blends: {blend_names}",
                    field="tanker_id",
                ))

        # Check emirate coverage
        if customer.emirate_id:
            if not tanker.covers_emirate(customer.emirate_id):
                emirate_names = ", ".join(e.name for e in tanker.emirates)
                errors.append(ValidationError(
                    code="EMIRATE_NOT_COVERED",
                    message=f"Tanker only covers: {emirate_names}",
                    field="tanker_id",
                ))

        # Check delivery type compatibility
        if not tanker.can_deliver_to_customer_type(customer.customer_type.value):
            errors.append(ValidationError(
                code="INCOMPATIBLE_DELIVERY_TYPE",
                message=f"Tanker delivery type ({tanker.delivery_type.value}) doesn't match customer type ({customer.customer_type.value})",
                field="tanker_id",
            ))

        # Check tanker status
        if tanker.status.value != "active":
            warnings.append(ValidationError(
                code="TANKER_NOT_ACTIVE",
                message=f"Tanker status is '{tanker.status.value}'",
                field="tanker_id",
            ))

        if errors:
            return ValidationResult.failure(errors, warnings)

        return ValidationResult(is_valid=True, errors=[], warnings=warnings)

    def check_trip_conflicts(
        self,
        tanker_id: int,
        schedule_date,
        start_time: time,
        end_time: time,
        exclude_trip_id: Optional[int] = None,
    ) -> list[Trip]:
        """
        Check for overlapping trips for the same tanker.

        Returns list of conflicting trips.
        """
        from app.models.schedule import DailySchedule

        query = (
            self.db.query(Trip)
            .join(DailySchedule)
            .filter(DailySchedule.schedule_date == schedule_date)
            .filter(Trip.tanker_id == tanker_id)
            .filter(Trip.status != TripStatus.CANCELLED)
        )

        if exclude_trip_id:
            query = query.filter(Trip.id != exclude_trip_id)

        # Find overlapping time slots
        # Two time ranges overlap if: start1 < end2 AND start2 < end1
        conflicts = []
        for existing_trip in query.all():
            if start_time < existing_trip.end_time and existing_trip.start_time < end_time:
                conflicts.append(existing_trip)

        return conflicts

    def get_compatible_tankers(
        self,
        customer: Customer,
        fuel_blend_id: Optional[int],
        volume: int,
    ) -> list[Tanker]:
        """
        Get list of tankers compatible with trip requirements.

        Filters by:
        - Active status
        - Capacity >= volume
        - Supports fuel blend (if specified)
        - Covers customer's emirate
        - Compatible delivery type
        """
        from app.models.tanker import TankerStatus

        query = (
            self.db.query(Tanker)
            .filter(Tanker.is_active == True)
            .filter(Tanker.status == TankerStatus.ACTIVE)
            .filter(Tanker.max_capacity >= volume)
        )

        tankers = query.all()

        # Filter in Python for complex conditions
        compatible = []
        for tanker in tankers:
            # Check fuel blend
            if fuel_blend_id and not tanker.supports_blend(fuel_blend_id):
                continue

            # Check emirate
            if customer.emirate_id and not tanker.covers_emirate(customer.emirate_id):
                continue

            # Check delivery type
            if not tanker.can_deliver_to_customer_type(customer.customer_type.value):
                continue

            compatible.append(tanker)

        return compatible


def validate_trip_assignment(
    db: Session,
    trip: Trip,
    tanker_id: int,
) -> ValidationResult:
    """
    Validate tanker assignment for a trip.

    Convenience function that creates service and validates.
    """
    service = TripValidationService(db)

    tanker = db.query(Tanker).filter(Tanker.id == tanker_id).first()
    if not tanker:
        return ValidationResult.failure([
            ValidationError(
                code="TANKER_NOT_FOUND",
                message="Tanker not found",
                field="tanker_id",
            )
        ])

    customer = db.query(Customer).filter(Customer.id == trip.customer_id).first()
    if not customer:
        return ValidationResult.failure([
            ValidationError(
                code="CUSTOMER_NOT_FOUND",
                message="Customer not found",
                field="customer_id",
            )
        ])

    return service.validate_tanker_assignment(trip, tanker, customer)
