#!/bin/bash
# ============================================
# NF Dispatch Planner - Database Backup Script
# ============================================
#
# This script creates a backup of the PostgreSQL database
# and optionally uploads it to a remote storage location.
#
# Usage:
#   ./scripts/backup.sh              # Create backup
#   ./scripts/backup.sh --restore    # Restore from latest backup
#   ./scripts/backup.sh --list       # List available backups
#
# Environment Variables:
#   DB_USER       - Database user (default: nfadmin)
#   DB_PASSWORD   - Database password
#   DB_NAME       - Database name (default: nf_dispatch)
#   DB_HOST       - Database host (default: localhost)
#   BACKUP_DIR    - Backup directory (default: ./backups)
#   BACKUP_RETENTION_DAYS - Days to keep backups (default: 30)
#

set -e

# Configuration
DB_USER="${DB_USER:-nfadmin}"
DB_NAME="${DB_NAME:-nf_dispatch}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Timestamp for backup file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/nf_dispatch_${TIMESTAMP}.sql.gz"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

create_backup() {
    log_info "Starting database backup..."

    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"

    # Check if running in Docker
    if [ -f /.dockerenv ]; then
        log_info "Running inside Docker container"
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-owner \
            --no-privileges \
            | gzip > "$BACKUP_FILE"
    else
        log_info "Running on host machine"
        # Use docker exec to run pg_dump in the container
        docker exec nf-postgres pg_dump \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-owner \
            --no-privileges \
            | gzip > "$BACKUP_FILE"
    fi

    # Verify backup was created
    if [ -f "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Backup created successfully: $BACKUP_FILE ($BACKUP_SIZE)"
    else
        log_error "Backup file was not created!"
        exit 1
    fi

    # Cleanup old backups
    cleanup_old_backups
}

restore_backup() {
    RESTORE_FILE="$1"

    if [ -z "$RESTORE_FILE" ]; then
        # Find latest backup
        RESTORE_FILE=$(ls -t "$BACKUP_DIR"/nf_dispatch_*.sql.gz 2>/dev/null | head -n 1)
        if [ -z "$RESTORE_FILE" ]; then
            log_error "No backup files found in $BACKUP_DIR"
            exit 1
        fi
    fi

    if [ ! -f "$RESTORE_FILE" ]; then
        log_error "Backup file not found: $RESTORE_FILE"
        exit 1
    fi

    log_warn "This will REPLACE all data in the database!"
    read -p "Are you sure you want to restore from $RESTORE_FILE? (y/N) " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    log_info "Restoring from: $RESTORE_FILE"

    # Check if running in Docker
    if [ -f /.dockerenv ]; then
        gunzip -c "$RESTORE_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME"
    else
        gunzip -c "$RESTORE_FILE" | docker exec -i nf-postgres psql \
            -U "$DB_USER" \
            -d "$DB_NAME"
    fi

    log_info "Database restored successfully"
}

list_backups() {
    log_info "Available backups in $BACKUP_DIR:"
    echo ""

    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        log_warn "No backups found"
        return
    fi

    printf "%-40s %10s %s\n" "FILENAME" "SIZE" "DATE"
    printf "%-40s %10s %s\n" "----------------------------------------" "----------" "-------------------"

    for file in "$BACKUP_DIR"/nf_dispatch_*.sql.gz; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            size=$(du -h "$file" | cut -f1)
            date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d'.' -f1)
            printf "%-40s %10s %s\n" "$filename" "$size" "$date"
        fi
    done
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."

    find "$BACKUP_DIR" -name "nf_dispatch_*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete

    REMAINING=$(ls -1 "$BACKUP_DIR"/nf_dispatch_*.sql.gz 2>/dev/null | wc -l)
    log_info "Remaining backups: $REMAINING"
}

show_help() {
    echo "NF Dispatch Planner - Database Backup Script"
    echo ""
    echo "Usage:"
    echo "  $0              Create a new backup"
    echo "  $0 --restore    Restore from the latest backup"
    echo "  $0 --restore <file>  Restore from a specific backup file"
    echo "  $0 --list       List available backups"
    echo "  $0 --cleanup    Cleanup old backups"
    echo "  $0 --help       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DB_USER                  Database user (default: nfadmin)"
    echo "  DB_PASSWORD              Database password"
    echo "  DB_NAME                  Database name (default: nf_dispatch)"
    echo "  DB_HOST                  Database host (default: localhost)"
    echo "  BACKUP_DIR               Backup directory (default: ./backups)"
    echo "  BACKUP_RETENTION_DAYS    Days to keep backups (default: 30)"
}

# Main script
case "${1:-}" in
    --restore)
        restore_backup "$2"
        ;;
    --list)
        list_backups
        ;;
    --cleanup)
        cleanup_old_backups
        ;;
    --help|-h)
        show_help
        ;;
    *)
        create_backup
        ;;
esac
