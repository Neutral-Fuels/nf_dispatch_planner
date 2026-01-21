"""Redis caching service."""

import json
from datetime import timedelta
from functools import wraps
from typing import Any, Callable, Optional, TypeVar, Union

import redis
from redis.exceptions import RedisError

from app.config import settings

# Redis client
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> Optional[redis.Redis]:
    """Get or create Redis client."""
    global _redis_client

    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            # Test connection
            _redis_client.ping()
        except RedisError as e:
            print(f"Warning: Redis connection failed: {e}")
            _redis_client = None

    return _redis_client


class CacheService:
    """Service for caching data in Redis."""

    # Cache key prefixes
    PREFIX_DASHBOARD = "dashboard"
    PREFIX_SCHEDULE = "schedule"
    PREFIX_REFERENCE = "reference"
    PREFIX_USER = "user"

    # Default TTLs (in seconds)
    TTL_SHORT = 60  # 1 minute
    TTL_MEDIUM = 300  # 5 minutes
    TTL_LONG = 3600  # 1 hour
    TTL_REFERENCE = 86400  # 24 hours (for static reference data)

    def __init__(self):
        self.client = get_redis_client()

    def _make_key(self, prefix: str, key: str) -> str:
        """Create a namespaced cache key."""
        return f"nf:{prefix}:{key}"

    def get(self, prefix: str, key: str) -> Optional[Any]:
        """Get a value from cache."""
        if not self.client:
            return None

        try:
            cache_key = self._make_key(prefix, key)
            value = self.client.get(cache_key)
            if value:
                return json.loads(value)
        except (RedisError, json.JSONDecodeError) as e:
            print(f"Cache get error: {e}")

        return None

    def set(
        self,
        prefix: str,
        key: str,
        value: Any,
        ttl: int = TTL_MEDIUM,
    ) -> bool:
        """Set a value in cache with TTL."""
        if not self.client:
            return False

        try:
            cache_key = self._make_key(prefix, key)
            self.client.setex(
                cache_key,
                timedelta(seconds=ttl),
                json.dumps(value, default=str),
            )
            return True
        except (RedisError, TypeError) as e:
            print(f"Cache set error: {e}")
            return False

    def delete(self, prefix: str, key: str) -> bool:
        """Delete a value from cache."""
        if not self.client:
            return False

        try:
            cache_key = self._make_key(prefix, key)
            self.client.delete(cache_key)
            return True
        except RedisError as e:
            print(f"Cache delete error: {e}")
            return False

    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        if not self.client:
            return 0

        try:
            full_pattern = f"nf:{pattern}"
            keys = self.client.keys(full_pattern)
            if keys:
                return self.client.delete(*keys)
        except RedisError as e:
            print(f"Cache delete pattern error: {e}")

        return 0

    def invalidate_dashboard(self, date_str: Optional[str] = None):
        """Invalidate dashboard cache."""
        if date_str:
            self.delete(self.PREFIX_DASHBOARD, f"summary:{date_str}")
            self.delete(self.PREFIX_DASHBOARD, f"tanker_util:{date_str}")
            self.delete(self.PREFIX_DASHBOARD, f"driver_status:{date_str}")
        else:
            self.delete_pattern(f"{self.PREFIX_DASHBOARD}:*")

    def invalidate_schedule(self, date_str: str):
        """Invalidate schedule cache for a date."""
        self.delete(self.PREFIX_SCHEDULE, date_str)
        self.invalidate_dashboard(date_str)

    def invalidate_reference(self):
        """Invalidate reference data cache."""
        self.delete_pattern(f"{self.PREFIX_REFERENCE}:*")


# Decorator for caching function results
T = TypeVar("T")


def cached(
    prefix: str,
    key_func: Callable[..., str],
    ttl: int = CacheService.TTL_MEDIUM,
):
    """
    Decorator for caching function results.

    Usage:
        @cached("dashboard", lambda date: f"summary:{date}", ttl=300)
        def get_dashboard_summary(date: str):
            ...
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            cache = CacheService()

            # Generate cache key from arguments
            cache_key = key_func(*args, **kwargs)

            # Try to get from cache
            cached_value = cache.get(prefix, cache_key)
            if cached_value is not None:
                return cached_value

            # Execute function
            result = func(*args, **kwargs)

            # Cache the result
            cache.set(prefix, cache_key, result, ttl)

            return result

        return wrapper

    return decorator


# Global cache service instance
cache_service = CacheService()
