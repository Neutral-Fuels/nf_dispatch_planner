"""Initial migration - Create all tables.

Revision ID: 001_initial
Revises:
Create Date: 2025-01-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Emirates table
    op.create_table(
        'emirates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(10), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_emirates_id', 'emirates', ['id'])

    # Fuel blends table
    op.create_table(
        'fuel_blends',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(10), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('biodiesel_percentage', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_fuel_blends_id', 'fuel_blends', ['id'])

    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('email', sa.String(100), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=True),
        sa.Column('role', sa.Enum('admin', 'dispatcher', 'viewer', name='userrole'), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('failed_login_attempts', sa.Integer(), default=0),
        sa.Column('locked_until', sa.DateTime(), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('ix_users_email', 'users', ['email'])

    # Drivers table
    op.create_table(
        'drivers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('employee_id', sa.String(50), nullable=True),
        sa.Column('driver_type', sa.Enum('internal', '3pl', name='drivertype'), nullable=False),
        sa.Column('contact_phone', sa.String(20), nullable=True),
        sa.Column('license_number', sa.String(50), nullable=True),
        sa.Column('license_expiry', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('employee_id')
    )
    op.create_index('ix_drivers_id', 'drivers', ['id'])
    op.create_index('ix_drivers_is_active', 'drivers', ['is_active'])

    # Driver schedules table
    op.create_table(
        'driver_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('driver_id', sa.Integer(), nullable=False),
        sa.Column('schedule_date', sa.Date(), nullable=False),
        sa.Column('status', sa.Enum('working', 'off', 'holiday', 'float', name='driverstatus'), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('driver_id', 'schedule_date', name='uq_driver_date')
    )
    op.create_index('ix_driver_schedules_id', 'driver_schedules', ['id'])
    op.create_index('ix_driver_schedules_schedule_date', 'driver_schedules', ['schedule_date'])

    # Tankers table
    op.create_table(
        'tankers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('registration', sa.String(50), nullable=True),
        sa.Column('max_capacity', sa.Integer(), nullable=False),
        sa.Column('delivery_type', sa.Enum('bulk', 'mobile', 'both', name='deliverytype'), nullable=False),
        sa.Column('status', sa.Enum('active', 'maintenance', 'inactive', name='tankerstatus'), default='active'),
        sa.Column('is_3pl', sa.Boolean(), default=False),
        sa.Column('default_driver_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['default_driver_id'], ['drivers.id'], ondelete='SET NULL')
    )
    op.create_index('ix_tankers_id', 'tankers', ['id'])
    op.create_index('ix_tankers_is_active', 'tankers', ['is_active'])

    # Tanker-blends junction table
    op.create_table(
        'tanker_blends',
        sa.Column('tanker_id', sa.Integer(), nullable=False),
        sa.Column('fuel_blend_id', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('tanker_id', 'fuel_blend_id'),
        sa.ForeignKeyConstraint(['tanker_id'], ['tankers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['fuel_blend_id'], ['fuel_blends.id'], ondelete='CASCADE')
    )

    # Tanker-emirates junction table
    op.create_table(
        'tanker_emirates',
        sa.Column('tanker_id', sa.Integer(), nullable=False),
        sa.Column('emirate_id', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('tanker_id', 'emirate_id'),
        sa.ForeignKeyConstraint(['tanker_id'], ['tankers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['emirate_id'], ['emirates.id'], ondelete='CASCADE')
    )

    # Customers table
    op.create_table(
        'customers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('customer_type', sa.Enum('bulk', 'mobile', name='customertype'), nullable=False),
        sa.Column('fuel_blend_id', sa.Integer(), nullable=True),
        sa.Column('estimated_volume', sa.Integer(), nullable=True),
        sa.Column('emirate_id', sa.Integer(), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('contact_name', sa.String(100), nullable=True),
        sa.Column('contact_phone', sa.String(20), nullable=True),
        sa.Column('contact_email', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.ForeignKeyConstraint(['fuel_blend_id'], ['fuel_blends.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['emirate_id'], ['emirates.id'], ondelete='SET NULL')
    )
    op.create_index('ix_customers_id', 'customers', ['id'])
    op.create_index('ix_customers_code', 'customers', ['code'])
    op.create_index('ix_customers_is_active', 'customers', ['is_active'])

    # Daily schedules table
    op.create_table(
        'daily_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_date', sa.Date(), nullable=False),
        sa.Column('is_locked', sa.Boolean(), default=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('schedule_date')
    )
    op.create_index('ix_daily_schedules_id', 'daily_schedules', ['id'])
    op.create_index('ix_daily_schedules_schedule_date', 'daily_schedules', ['schedule_date'])

    # Weekly templates table
    op.create_table(
        'weekly_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('tanker_id', sa.Integer(), nullable=True),
        sa.Column('fuel_blend_id', sa.Integer(), nullable=True),
        sa.Column('volume', sa.Integer(), nullable=False),
        sa.Column('is_mobile_op', sa.Boolean(), default=False),
        sa.Column('needs_return', sa.Boolean(), default=False),
        sa.Column('priority', sa.Integer(), default=0),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tanker_id'], ['tankers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['fuel_blend_id'], ['fuel_blends.id'], ondelete='SET NULL')
    )
    op.create_index('ix_weekly_templates_id', 'weekly_templates', ['id'])
    op.create_index('ix_weekly_templates_day_of_week', 'weekly_templates', ['day_of_week'])

    # Trips table
    op.create_table(
        'trips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('daily_schedule_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('tanker_id', sa.Integer(), nullable=True),
        sa.Column('driver_id', sa.Integer(), nullable=True),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('fuel_blend_id', sa.Integer(), nullable=True),
        sa.Column('volume', sa.Integer(), nullable=False),
        sa.Column('is_mobile_op', sa.Boolean(), default=False),
        sa.Column('needs_return', sa.Boolean(), default=False),
        sa.Column('status', sa.Enum('scheduled', 'unassigned', 'conflict', 'completed', 'cancelled', name='tripstatus'), default='unassigned'),
        sa.Column('sequence', sa.Integer(), default=0),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['daily_schedule_id'], ['daily_schedules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['weekly_templates.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tanker_id'], ['tankers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['driver_id'], ['drivers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['fuel_blend_id'], ['fuel_blends.id'], ondelete='SET NULL')
    )
    op.create_index('ix_trips_id', 'trips', ['id'])


def downgrade() -> None:
    op.drop_table('trips')
    op.drop_table('weekly_templates')
    op.drop_table('daily_schedules')
    op.drop_table('customers')
    op.drop_table('tanker_emirates')
    op.drop_table('tanker_blends')
    op.drop_table('tankers')
    op.drop_table('driver_schedules')
    op.drop_table('drivers')
    op.drop_table('users')
    op.drop_table('fuel_blends')
    op.drop_table('emirates')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS tripstatus')
    op.execute('DROP TYPE IF EXISTS tankerstatus')
    op.execute('DROP TYPE IF EXISTS deliverytype')
    op.execute('DROP TYPE IF EXISTS driverstatus')
    op.execute('DROP TYPE IF EXISTS drivertype')
    op.execute('DROP TYPE IF EXISTS customertype')
    op.execute('DROP TYPE IF EXISTS userrole')
