"""Authentication endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.services.auth import AuthService

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: DbSession):
    """
    Authenticate user and return JWT token.

    - **username**: User's username
    - **password**: User's password
    """
    auth_service = AuthService(db)
    user = auth_service.authenticate_user(request.username, request.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return auth_service.create_user_token(user)


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: CurrentUser):
    """Get current authenticated user information."""
    return current_user


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Change the current user's password.

    - **current_password**: Current password for verification
    - **new_password**: New password (min 8 characters)
    """
    auth_service = AuthService(db)
    success = auth_service.change_password(
        current_user,
        request.current_password,
        request.new_password,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    return {"message": "Password changed successfully"}
