#!/usr/bin/env python3
"""
Seed data script for NF Dispatch Planner.

This script creates initial reference data and a default admin user.

Usage:
    python scripts/seed_data.py
"""

import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models.reference import Emirate, FuelBlend
from app.models.user import User, UserRole
from app.utils.security import get_password_hash


def seed_emirates(db: Session) -> None:
    """Seed UAE Emirates data."""
    emirates_data = [
        {"code": "DXB", "name": "Dubai"},
        {"code": "AUH", "name": "Abu Dhabi"},
        {"code": "SHJ", "name": "Sharjah"},
        {"code": "AJM", "name": "Ajman"},
        {"code": "RAK", "name": "Ras Al Khaimah"},
        {"code": "FUJ", "name": "Fujairah"},
        {"code": "UAQ", "name": "Umm Al Quwain"},
    ]

    for data in emirates_data:
        existing = db.query(Emirate).filter(Emirate.code == data["code"]).first()
        if not existing:
            emirate = Emirate(
                code=data["code"],
                name=data["name"],
                is_active=True,
                created_at=datetime.utcnow(),
            )
            db.add(emirate)
            print(f"  Added emirate: {data['name']} ({data['code']})")
        else:
            print(f"  Emirate already exists: {data['name']} ({data['code']})")

    db.commit()


def seed_fuel_blends(db: Session) -> None:
    """Seed fuel blend types."""
    blends_data = [
        {"code": "B0", "name": "Pure Diesel", "biodiesel_percentage": 0},
        {"code": "B5", "name": "5% Biodiesel Blend", "biodiesel_percentage": 5},
        {"code": "B7", "name": "7% Biodiesel Blend", "biodiesel_percentage": 7},
        {"code": "B10", "name": "10% Biodiesel Blend", "biodiesel_percentage": 10},
        {"code": "B20", "name": "20% Biodiesel Blend", "biodiesel_percentage": 20},
        {"code": "B100", "name": "Pure Biodiesel", "biodiesel_percentage": 100},
    ]

    for data in blends_data:
        existing = db.query(FuelBlend).filter(FuelBlend.code == data["code"]).first()
        if not existing:
            blend = FuelBlend(
                code=data["code"],
                name=data["name"],
                biodiesel_percentage=data["biodiesel_percentage"],
                is_active=True,
                created_at=datetime.utcnow(),
            )
            db.add(blend)
            print(f"  Added fuel blend: {data['name']} ({data['code']})")
        else:
            print(f"  Fuel blend already exists: {data['name']} ({data['code']})")

    db.commit()


def seed_admin_user(db: Session) -> None:
    """Create default admin user."""
    admin_username = "admin"
    admin_email = "admin@neutralfuels.com"
    admin_password = "admin123"  # Should be changed on first login!

    existing = db.query(User).filter(User.username == admin_username).first()
    if not existing:
        admin = User(
            username=admin_username,
            email=admin_email,
            password_hash=get_password_hash(admin_password),
            full_name="System Administrator",
            role=UserRole.ADMIN,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(admin)
        db.commit()
        print(f"  Created admin user: {admin_username}")
        print(f"  Default password: {admin_password}")
        print("  ⚠️  IMPORTANT: Change the password on first login!")
    else:
        print(f"  Admin user already exists: {admin_username}")


def seed_demo_users(db: Session) -> None:
    """Create demo users for each role (development only)."""
    demo_users = [
        {
            "username": "dispatcher",
            "email": "dispatcher@neutralfuels.com",
            "password": "dispatcher123",
            "full_name": "Demo Dispatcher",
            "role": UserRole.DISPATCHER,
        },
        {
            "username": "viewer",
            "email": "viewer@neutralfuels.com",
            "password": "viewer123",
            "full_name": "Demo Viewer",
            "role": UserRole.VIEWER,
        },
    ]

    for data in demo_users:
        existing = db.query(User).filter(User.username == data["username"]).first()
        if not existing:
            user = User(
                username=data["username"],
                email=data["email"],
                password_hash=get_password_hash(data["password"]),
                full_name=data["full_name"],
                role=data["role"],
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(user)
            print(f"  Created demo user: {data['username']} ({data['role'].value})")
        else:
            print(f"  Demo user already exists: {data['username']}")

    db.commit()


def main():
    """Run all seed functions."""
    print("\n" + "=" * 50)
    print("NF Dispatch Planner - Seed Data Script")
    print("=" * 50 + "\n")

    # Create tables if they don't exist
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created (or already exist).\n")

    # Create session
    db = SessionLocal()

    try:
        # Seed reference data
        print("Seeding Emirates...")
        seed_emirates(db)
        print()

        print("Seeding Fuel Blends...")
        seed_fuel_blends(db)
        print()

        print("Creating Admin User...")
        seed_admin_user(db)
        print()

        # Optional: Create demo users for development
        print("Creating Demo Users (for development)...")
        seed_demo_users(db)
        print()

        print("=" * 50)
        print("Seed data complete!")
        print("=" * 50)
        print("\nDefault Login Credentials:")
        print("  Admin:      admin / admin123")
        print("  Dispatcher: dispatcher / dispatcher123")
        print("  Viewer:     viewer / viewer123")
        print("\n⚠️  Remember to change passwords in production!\n")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
