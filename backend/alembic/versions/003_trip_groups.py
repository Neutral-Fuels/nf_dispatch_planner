"""Add trip groups and weekly driver assignments.

Revision ID: 003_trip_groups
Revises: 002_add_audit_logs
Create Date: 2026-01-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_trip_groups'
down_revision: Union[str, None] = '002_add_audit_logs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create trip_groups, trip_group_templates, and weekly_driver_assignments tables."""

    # Create trip_groups table
    op.create_table(
        'trip_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),  # 0=Saturday, 6=Friday
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('day_of_week >= 0 AND day_of_week <= 6', name='valid_day'),
    )
    op.create_index('ix_trip_groups_id', 'trip_groups', ['id'])
    op.create_index('ix_trip_groups_day_of_week', 'trip_groups', ['day_of_week'])
    op.create_index('ix_trip_groups_is_active', 'trip_groups', ['is_active'])

    # Create trip_group_templates association table (many-to-many)
    op.create_table(
        'trip_group_templates',
        sa.Column('trip_group_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['trip_group_id'], ['trip_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['weekly_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('trip_group_id', 'template_id'),
    )

    # Create weekly_driver_assignments table
    op.create_table(
        'weekly_driver_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trip_group_id', sa.Integer(), nullable=False),
        sa.Column('driver_id', sa.Integer(), nullable=False),
        sa.Column('week_start_date', sa.Date(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('assigned_by', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['trip_group_id'], ['trip_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trip_group_id', 'week_start_date', name='unique_group_week'),
        sa.UniqueConstraint('driver_id', 'week_start_date', name='unique_driver_week'),
    )
    op.create_index('ix_weekly_driver_assignments_id', 'weekly_driver_assignments', ['id'])
    op.create_index('ix_weekly_driver_assignments_week_start_date', 'weekly_driver_assignments', ['week_start_date'])


def downgrade() -> None:
    """Drop trip groups tables."""
    op.drop_index('ix_weekly_driver_assignments_week_start_date', table_name='weekly_driver_assignments')
    op.drop_index('ix_weekly_driver_assignments_id', table_name='weekly_driver_assignments')
    op.drop_table('weekly_driver_assignments')
    op.drop_table('trip_group_templates')
    op.drop_index('ix_trip_groups_is_active', table_name='trip_groups')
    op.drop_index('ix_trip_groups_day_of_week', table_name='trip_groups')
    op.drop_index('ix_trip_groups_id', table_name='trip_groups')
    op.drop_table('trip_groups')
