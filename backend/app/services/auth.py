"""Authentication service."""

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.utils.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)


class AuthService:
    """Authentication and authorization service."""

    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 30

    def __init__(self, db: Session):
        self.db = db

    def authenticate_user(
        self, username: str, password: str
    ) -> Optional[User]:
        """Authenticate a user by username and password."""
        user = self.db.query(User).filter(User.username == username).first()

        if not user:
            return None

        # Check if account is locked
        if user.locked_until and user.locked_until > datetime.utcnow():
            return None

        # Check if user is active
        if not user.is_active:
            return None

        # Verify password
        if not verify_password(password, user.password_hash):
            # Increment failed attempts
            user.failed_login_attempts += 1

            # Lock account if too many failed attempts
            if user.failed_login_attempts >= self.MAX_FAILED_ATTEMPTS:
                user.locked_until = datetime.utcnow() + timedelta(
                    minutes=self.LOCKOUT_DURATION_MINUTES
                )

            self.db.commit()
            return None

        # Reset failed attempts on successful login
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login = datetime.utcnow()
        self.db.commit()

        return user

    def create_user_token(self, user: User) -> dict:
        """Create access token for user."""
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "username": user.username,
                "role": user.role.value,
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_seconds,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value,
            },
        }

    def change_password(
        self, user: User, current_password: str, new_password: str
    ) -> bool:
        """Change user password."""
        if not verify_password(current_password, user.password_hash):
            return False

        user.password_hash = get_password_hash(new_password)
        self.db.commit()
        return True

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password for storage."""
        return get_password_hash(password)
