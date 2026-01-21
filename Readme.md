# NF Dispatch Planner

**Fuel Delivery Schedule Management System for Neutral Fuels**

A containerized web application to manage driver shifts, tanker assignments, and customer delivery schedules for biodiesel fuel distribution operations.

## 🎯 Project Overview

This application replaces the existing Excel-based scheduling system (`Schedule_Planning_-_2025.xlsm`) with a modern web interface that provides:

- **Driver Shift Planning** - Weekly rotating schedules for drivers
- **Tanker Fleet Management** - Capacity, fuel types, delivery capabilities, and emirate coverage
- **Customer Pool Management** - Bulk vs mobile customers, recurring weekly schedules
- **Trip Planning & Assignment** - Match drivers, tankers, and customers with constraint validation
- **Daily Schedule Generation** - Auto-generate schedules from templates for any selected date
- **Driver Sheets** - Print/export individual driver assignments

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                          │
├─────────────┬─────────────────┬──────────────┬─────────────────┤
│   Frontend  │     Backend     │   Database   │     Redis       │
│   (React)   │   (FastAPI)     │ (PostgreSQL) │    (Cache)      │
│   :3000     │     :8000       │    :5432     │     :6379       │
└─────────────┴─────────────────┴──────────────┴─────────────────┘
```

## 📁 Project Structure

```
nf-dispatch-planner/
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── 01-REQUIREMENTS.md
│   ├── 02-DATABASE-SCHEMA.md
│   ├── 03-API-SPECIFICATION.md
│   ├── 04-FRONTEND-DESIGN.md
│   ├── 05-DOCKER-SETUP.md
│   └── 06-DEVELOPMENT-TIMELINE.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   └── utils/
│   └── alembic/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── store/
└── nginx/
    └── nginx.conf
```

## 🚀 Quick Start

```bash
# Clone repository
git clone <repository-url>
cd nf-dispatch-planner

# Copy environment file
cp .env.example .env
# Edit .env with your settings

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs

# Default admin credentials (change on first login)
# Username: admin
# Password: admin123
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [01-REQUIREMENTS.md](docs/01-REQUIREMENTS.md) | Functional & non-functional requirements |
| [02-DATABASE-SCHEMA.md](docs/02-DATABASE-SCHEMA.md) | Complete database design with ERD |
| [03-API-SPECIFICATION.md](docs/03-API-SPECIFICATION.md) | RESTful API endpoints |
| [04-FRONTEND-DESIGN.md](docs/04-FRONTEND-DESIGN.md) | UI/UX specifications & wireframes |
| [05-DOCKER-SETUP.md](docs/05-DOCKER-SETUP.md) | Container configuration guide |
| [06-DEVELOPMENT-TIMELINE.md](docs/06-DEVELOPMENT-TIMELINE.md) | Sprint planning & milestones |

## 🔑 Key Features

### User Management

- Role-based access (Admin, Dispatcher, Viewer)
- No public signup - users created by admin only
- Session-based authentication with JWT tokens

### Tanker Management

- Fuel type capabilities (B0, B5, B7, B10, B20, B100)
- Delivery type (Bulk, Mobile, Both)
- Emirate coverage restrictions
- Maximum capacity tracking (Liters)

### Customer Management

- Customer type: Bulk (Tank) or Mobile Refueling
- Multiple trips per day with different time windows
- Weekly recurring schedule templates
- Estimated volume requirements
- Required fuel blend

### Schedule Planning

- Visual timeline view (Gantt-style)
- Drag-and-drop trip assignment
- Constraint validation:
  - Tanker capacity vs customer volume
  - Tanker fuel type vs customer requirement
  - Tanker delivery type vs customer type
  - Tanker emirate coverage vs customer location
- Conflict detection for overlapping trips

### Driver Scheduling

- Monthly rotating shift patterns
- Status types: Working, OFF, Holiday (HOL), Float (F)
- Trip assignment aligned with driver availability
- Printable driver sheets with weekly assignments

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, TailwindCSS, React Query |
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Container | Docker, Docker Compose |
| API Docs | OpenAPI/Swagger |

## 📞 Support

For questions or issues, contact the IT team at Neutral Fuels.

---

**Version:** 1.0.0  
**Last Updated:** January 2025
