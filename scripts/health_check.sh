#!/bin/bash
# ============================================
# NF Dispatch Planner - Health Check Script
# ============================================
#
# This script checks the health of all services
# and can be used for monitoring and alerting.
#
# Usage:
#   ./scripts/health_check.sh
#
# Exit codes:
#   0 - All services healthy
#   1 - One or more services unhealthy
#

set -e

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Tracking overall health
OVERALL_HEALTHY=true

# Functions
log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    OVERALL_HEALTHY=false
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_container() {
    local container_name="$1"
    local display_name="$2"

    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        local status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "no-healthcheck")

        if [ "$status" = "healthy" ]; then
            log_success "$display_name container is healthy"
        elif [ "$status" = "no-healthcheck" ]; then
            log_success "$display_name container is running (no health check)"
        else
            log_error "$display_name container status: $status"
        fi
    else
        log_error "$display_name container is not running"
    fi
}

check_backend_health() {
    local response
    local http_code

    response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health" 2>/dev/null || echo "error")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        log_success "Backend API is responding"

        # Parse JSON response
        status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        version=$(echo "$body" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
        redis=$(echo "$body" | grep -o '"redis":"[^"]*"' | cut -d'"' -f4)

        echo "         - Status: $status"
        echo "         - Version: $version"
        echo "         - Redis: $redis"

        if [ "$redis" != "connected" ]; then
            log_warn "Redis is not connected"
        fi
    else
        log_error "Backend API not responding (HTTP $http_code)"
    fi
}

check_frontend_health() {
    local http_code

    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
        log_success "Frontend is responding"
    else
        log_error "Frontend not responding (HTTP $http_code)"
    fi
}

check_database() {
    if docker exec nf-postgres pg_isready -U nfadmin -d nf_dispatch > /dev/null 2>&1; then
        log_success "PostgreSQL database is accepting connections"

        # Get database stats
        db_size=$(docker exec nf-postgres psql -U nfadmin -d nf_dispatch -t -c "SELECT pg_size_pretty(pg_database_size('nf_dispatch'));" 2>/dev/null | tr -d ' ')
        conn_count=$(docker exec nf-postgres psql -U nfadmin -d nf_dispatch -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'nf_dispatch';" 2>/dev/null | tr -d ' ')

        echo "         - Database size: $db_size"
        echo "         - Active connections: $conn_count"
    else
        log_error "PostgreSQL database is not accepting connections"
    fi
}

check_redis() {
    if docker exec nf-redis redis-cli --pass redis123 ping > /dev/null 2>&1; then
        log_success "Redis cache is responding"

        # Get Redis stats
        memory=$(docker exec nf-redis redis-cli --pass redis123 INFO memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r')
        keys=$(docker exec nf-redis redis-cli --pass redis123 DBSIZE 2>/dev/null | grep -o '[0-9]*')

        echo "         - Memory used: $memory"
        echo "         - Keys stored: $keys"
    else
        log_error "Redis cache is not responding"
    fi
}

check_disk_space() {
    local usage
    local mount_point

    # Check main disk usage
    usage=$(df -h . | tail -1 | awk '{print $5}' | tr -d '%')
    mount_point=$(df -h . | tail -1 | awk '{print $6}')

    if [ "$usage" -lt 80 ]; then
        log_success "Disk space is sufficient ($usage% used on $mount_point)"
    elif [ "$usage" -lt 90 ]; then
        log_warn "Disk space is getting low ($usage% used on $mount_point)"
    else
        log_error "Disk space is critically low ($usage% used on $mount_point)"
    fi
}

# Main
echo "============================================"
echo "NF Dispatch Planner - Health Check"
echo "============================================"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "--- Container Status ---"
check_container "nf-postgres" "PostgreSQL"
check_container "nf-redis" "Redis"
check_container "nf-backend" "Backend"
check_container "nf-frontend" "Frontend"
echo ""

echo "--- Service Health ---"
check_database
check_redis
check_backend_health
check_frontend_health
echo ""

echo "--- System Resources ---"
check_disk_space
echo ""

echo "============================================"
if [ "$OVERALL_HEALTHY" = true ]; then
    echo -e "${GREEN}Overall Status: HEALTHY${NC}"
    exit 0
else
    echo -e "${RED}Overall Status: UNHEALTHY${NC}"
    exit 1
fi
