"""Custom exceptions and error handling."""

from typing import Any, Optional

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Standard error response format."""

    error: str
    message: str
    details: Optional[Any] = None
    code: Optional[str] = None


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: Optional[str] = None,
        details: Optional[Any] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or "INTERNAL_ERROR"
        self.details = details
        super().__init__(self.message)


# Authentication exceptions
class AuthenticationError(AppException):
    """Authentication failed."""

    def __init__(self, message: str = "Authentication failed", details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTHENTICATION_ERROR",
            details=details,
        )


class InvalidCredentialsError(AuthenticationError):
    """Invalid username or password."""

    def __init__(self):
        super().__init__(message="Invalid username or password")
        self.error_code = "INVALID_CREDENTIALS"


class TokenExpiredError(AuthenticationError):
    """JWT token has expired."""

    def __init__(self):
        super().__init__(message="Token has expired")
        self.error_code = "TOKEN_EXPIRED"


class TokenInvalidError(AuthenticationError):
    """JWT token is invalid."""

    def __init__(self):
        super().__init__(message="Invalid token")
        self.error_code = "TOKEN_INVALID"


# Authorization exceptions
class AuthorizationError(AppException):
    """User not authorized for this action."""

    def __init__(self, message: str = "Not authorized", details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="AUTHORIZATION_ERROR",
            details=details,
        )


class InsufficientPermissionsError(AuthorizationError):
    """User doesn't have required permissions."""

    def __init__(self, required_role: Optional[str] = None):
        message = "Insufficient permissions"
        if required_role:
            message = f"Requires {required_role} role"
        super().__init__(message=message)
        self.error_code = "INSUFFICIENT_PERMISSIONS"


# Resource exceptions
class ResourceNotFoundError(AppException):
    """Requested resource not found."""

    def __init__(self, resource: str, identifier: Any = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with ID {identifier} not found"
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            details={"resource": resource, "identifier": identifier},
        )


class ResourceExistsError(AppException):
    """Resource already exists."""

    def __init__(self, resource: str, field: str, value: Any):
        super().__init__(
            message=f"{resource} with {field} '{value}' already exists",
            status_code=status.HTTP_409_CONFLICT,
            error_code="ALREADY_EXISTS",
            details={"resource": resource, "field": field, "value": value},
        )


# Validation exceptions
class ValidationError(AppException):
    """Request validation failed."""

    def __init__(self, message: str = "Validation failed", details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="VALIDATION_ERROR",
            details=details,
        )


class BusinessRuleError(AppException):
    """Business rule violation."""

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="BUSINESS_RULE_ERROR",
            details=details,
        )


# Schedule-specific exceptions
class ScheduleLockedError(BusinessRuleError):
    """Schedule is locked and cannot be modified."""

    def __init__(self, date: str):
        super().__init__(
            message=f"Schedule for {date} is locked",
            details={"date": date},
        )
        self.error_code = "SCHEDULE_LOCKED"


class TripConflictError(BusinessRuleError):
    """Trip has a scheduling conflict."""

    def __init__(self, conflicting_trips: list):
        super().__init__(
            message="Trip conflicts with existing trips",
            details={"conflicts": conflicting_trips},
        )
        self.error_code = "TRIP_CONFLICT"


class TankerValidationError(BusinessRuleError):
    """Tanker validation failed for trip assignment."""

    def __init__(self, errors: list[str]):
        super().__init__(
            message="Tanker not compatible with trip requirements",
            details={"validation_errors": errors},
        )
        self.error_code = "TANKER_VALIDATION_ERROR"


# Rate limiting
class RateLimitError(AppException):
    """Rate limit exceeded."""

    def __init__(self, retry_after: int = 60):
        super().__init__(
            message="Rate limit exceeded. Please slow down.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMIT_EXCEEDED",
            details={"retry_after": retry_after},
        )


# Exception handlers for FastAPI
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error_code,
            "message": exc.message,
            "details": exc.details,
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTPExceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP_ERROR",
            "message": exc.detail if isinstance(exc.detail, str) else "An error occurred",
            "details": exc.detail if not isinstance(exc.detail, str) else None,
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    # Log the full error for debugging
    import logging
    logger = logging.getLogger("app")
    logger.exception(f"Unhandled exception: {exc}")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
            "details": None,
        },
    )
