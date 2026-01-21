"""Rate limiting middleware using Redis."""

import time
from typing import Optional

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.cache import get_redis_client


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using Redis sliding window.

    Limits requests per IP address within a time window.
    """

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        exclude_paths: Optional[list[str]] = None,
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/openapi.json"]

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address."""
        # Check for proxy headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)

        redis_client = get_redis_client()

        # If Redis is not available, allow the request
        if not redis_client:
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        now = int(time.time())

        # Check minute limit
        minute_key = f"rate:minute:{client_ip}:{now // 60}"
        minute_count = redis_client.incr(minute_key)
        if minute_count == 1:
            redis_client.expire(minute_key, 60)

        if minute_count > self.requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please slow down.",
                headers={"Retry-After": "60"},
            )

        # Check hour limit
        hour_key = f"rate:hour:{client_ip}:{now // 3600}"
        hour_count = redis_client.incr(hour_key)
        if hour_count == 1:
            redis_client.expire(hour_key, 3600)

        if hour_count > self.requests_per_hour:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Hourly rate limit exceeded. Please try again later.",
                headers={"Retry-After": "3600"},
            )

        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.requests_per_minute - minute_count)
        )

        return response


class LoginRateLimiter:
    """
    Specific rate limiter for login attempts.

    Stricter limits to prevent brute force attacks.
    """

    MAX_ATTEMPTS = 5
    LOCKOUT_SECONDS = 300  # 5 minutes

    @classmethod
    def check_rate_limit(cls, username: str, client_ip: str) -> bool:
        """
        Check if login attempt is allowed.

        Returns True if allowed, raises HTTPException if blocked.
        """
        redis_client = get_redis_client()
        if not redis_client:
            return True

        # Check by username
        user_key = f"login:user:{username}"
        user_attempts = redis_client.get(user_key)

        if user_attempts and int(user_attempts) >= cls.MAX_ATTEMPTS:
            ttl = redis_client.ttl(user_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many login attempts. Try again in {ttl} seconds.",
                headers={"Retry-After": str(ttl)},
            )

        # Check by IP
        ip_key = f"login:ip:{client_ip}"
        ip_attempts = redis_client.get(ip_key)

        if ip_attempts and int(ip_attempts) >= cls.MAX_ATTEMPTS * 2:
            ttl = redis_client.ttl(ip_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many login attempts from this IP. Try again in {ttl} seconds.",
                headers={"Retry-After": str(ttl)},
            )

        return True

    @classmethod
    def record_failed_attempt(cls, username: str, client_ip: str):
        """Record a failed login attempt."""
        redis_client = get_redis_client()
        if not redis_client:
            return

        # Increment username attempts
        user_key = f"login:user:{username}"
        redis_client.incr(user_key)
        redis_client.expire(user_key, cls.LOCKOUT_SECONDS)

        # Increment IP attempts
        ip_key = f"login:ip:{client_ip}"
        redis_client.incr(ip_key)
        redis_client.expire(ip_key, cls.LOCKOUT_SECONDS)

    @classmethod
    def clear_attempts(cls, username: str, client_ip: str):
        """Clear login attempts after successful login."""
        redis_client = get_redis_client()
        if not redis_client:
            return

        redis_client.delete(f"login:user:{username}")
        redis_client.delete(f"login:ip:{client_ip}")
