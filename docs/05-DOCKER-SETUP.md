# 05 - Docker Setup & Configuration

## 1. Architecture Overview

```
                                    ┌─────────────────┐
                                    │    Browser      │
                                    └────────┬────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Docker Network (nf-network)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Nginx     │  │   Frontend  │  │   Backend   │  │    Redis    │ │
│  │   (Proxy)   │  │   (React)   │  │  (FastAPI)  │  │   (Cache)   │ │
│  │   :80/443   │  │    :3000    │  │    :8000    │  │    :6379    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │                │        │
│         │                │                │                │        │
│         │                │                ▼                ▼        │
│         │                │         ┌─────────────┐                  │
│         │                │         │  PostgreSQL │                  │
│         │                │         │    :5432    │                  │
│         │                │         └──────┬──────┘                  │
│         │                │                │                         │
│         │                │                ▼                         │
│         │                │         ┌─────────────┐                  │
│         │                │         │   Volume    │                  │
│         │                │         │  (pg_data)  │                  │
│         │                │         └─────────────┘                  │
└─────────┴────────────────┴──────────────────────────────────────────┘
```

---

## 2. Docker Compose Configuration

### 2.1 Main docker-compose.yml

```yaml
version: '3.8'

services:
  # ===================
  # PostgreSQL Database
  # ===================
  db:
    image: postgres:15-alpine
    container_name: nf-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-nfadmin}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-nfsecret123}
      POSTGRES_DB: ${DB_NAME:-nf_dispatch}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./backend/init-db:/docker-entrypoint-initdb.d:ro
    ports:
      - "${DB_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-nfadmin} -d ${DB_NAME:-nf_dispatch}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - nf-network

  # ===================
  # Redis Cache
  # ===================
  redis:
    image: redis:7-alpine
    container_name: nf-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-redis123}
    volumes:
      - redis_data:/data
    ports:
      - "${REDIS_PORT:-6379}:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--pass", "${REDIS_PASSWORD:-redis123}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - nf-network

  # ===================
  # FastAPI Backend
  # ===================
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: nf-backend
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://${DB_USER:-nfadmin}:${DB_PASSWORD:-nfsecret123}@db:5432/${DB_NAME:-nf_dispatch}
      - REDIS_URL=redis://:${REDIS_PASSWORD:-redis123}@redis:6379/0
      - SECRET_KEY=${SECRET_KEY:-your-super-secret-key-change-in-production}
      - ENVIRONMENT=${ENVIRONMENT:-development}
      - DEBUG=${DEBUG:-true}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost}
    volumes:
      - ./backend/app:/app/app:ro
      - ./backend/alembic:/app/alembic:ro
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - nf-network

  # ===================
  # React Frontend
  # ===================
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - VITE_API_URL=${VITE_API_URL:-http://localhost:8000/api/v1}
    container_name: nf-frontend
    restart: unless-stopped
    environment:
      - VITE_API_URL=${VITE_API_URL:-http://localhost:8000/api/v1}
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    depends_on:
      - backend
    networks:
      - nf-network

  # ===================
  # Nginx Reverse Proxy (Production)
  # ===================
  nginx:
    image: nginx:alpine
    container_name: nf-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    profiles:
      - production
    networks:
      - nf-network

volumes:
  pg_data:
    driver: local
  redis_data:
    driver: local

networks:
  nf-network:
    driver: bridge
```

---

## 3. Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### 3.1 Backend Requirements

```txt
# backend/requirements.txt
# Framework
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Database
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
alembic==1.13.1

# Authentication
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Validation
pydantic==2.5.3
pydantic-settings==2.1.0
email-validator==2.1.0

# Redis
redis==5.0.1

# Utilities
python-dateutil==2.8.2
httpx==0.26.0

# Testing
pytest==7.4.4
pytest-asyncio==0.23.3
pytest-cov==4.1.0

# Development
black==24.1.1
isort==5.13.2
flake8==7.0.0
```

---

## 4. Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built assets
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN adduser -D appuser
USER appuser

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

### 4.1 Frontend Package.json (Key Dependencies)

```json
{
  "name": "nf-dispatch-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "@tanstack/react-query": "^5.17.0",
    "@tanstack/react-table": "^8.11.0",
    "zustand": "^4.4.7",
    "axios": "^1.6.5",
    "react-hook-form": "^7.49.0",
    "@hookform/resolvers": "^3.3.2",
    "zod": "^3.22.4",
    "date-fns": "^3.2.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.303.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.47",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11"
  }
}
```

---

## 5. Nginx Configuration

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Upstream servers
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name localhost;

        # Redirect HTTP to HTTPS (uncomment in production)
        # return 301 https://$server_name$request_uri;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # API
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeout settings
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Login rate limiting
        location /api/v1/auth/login {
            limit_req zone=login burst=5 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # API Documentation
        location /docs {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        # Health check
        location /health {
            proxy_pass http://backend;
        }
    }

    # HTTPS Server (uncomment in production)
    # server {
    #     listen 443 ssl http2;
    #     server_name localhost;
    #
    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #
    #     # ... same location blocks as above ...
    # }
}
```

---

## 6. Environment Configuration

### 6.1 Example .env File

```bash
# .env.example

# ===================
# Database
# ===================
DB_USER=nfadmin
DB_PASSWORD=nfsecret123
DB_NAME=nf_dispatch
DB_PORT=5432

# ===================
# Redis
# ===================
REDIS_PASSWORD=redis123
REDIS_PORT=6379

# ===================
# Backend
# ===================
SECRET_KEY=your-super-secret-key-change-in-production-min-32-chars
ENVIRONMENT=development
DEBUG=true
BACKEND_PORT=8000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost

# ===================
# Frontend
# ===================
FRONTEND_PORT=3000
VITE_API_URL=http://localhost:8000/api/v1

# ===================
# General
# ===================
COMPOSE_PROJECT_NAME=nf-dispatch
```

---

## 7. Development Commands

### 7.1 Initial Setup

```bash
# Clone and setup
git clone <repository-url>
cd nf-dispatch-planner

# Create environment file
cp .env.example .env
# Edit .env with your settings

# Build and start all services
docker-compose up -d --build

# Check logs
docker-compose logs -f

# Run database migrations
docker-compose exec backend alembic upgrade head

# Seed initial data (optional)
docker-compose exec backend python -m app.scripts.seed_data
```

### 7.2 Daily Development

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

### 7.3 Database Operations

```bash
# Connect to PostgreSQL
docker-compose exec db psql -U nfadmin -d nf_dispatch

# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "Description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1

# Backup database
docker-compose exec db pg_dump -U nfadmin nf_dispatch > backup.sql

# Restore database
docker-compose exec -T db psql -U nfadmin nf_dispatch < backup.sql
```

### 7.4 Testing

```bash
# Run backend tests
docker-compose exec backend pytest

# Run backend tests with coverage
docker-compose exec backend pytest --cov=app --cov-report=html

# Run frontend tests
docker-compose exec frontend npm test
```

---

## 8. Production Deployment

### 8.1 Production docker-compose.override.yml

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    environment:
      - DEBUG=false
      - ENVIRONMENT=production
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  frontend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  db:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
```

### 8.2 Production Startup

```bash
# Build for production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start with nginx
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d
```

---

## 9. Monitoring & Health Checks

### 9.1 Health Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Backend | `GET /health` | `{"status": "healthy"}` |
| PostgreSQL | `pg_isready` | Exit code 0 |
| Redis | `PING` | `PONG` |
| Frontend | `GET /` | HTTP 200 |

### 9.2 Monitoring Script

```bash
#!/bin/bash
# scripts/health-check.sh

echo "Checking service health..."

# Backend
if curl -sf http://localhost:8000/health > /dev/null; then
    echo "✓ Backend: Healthy"
else
    echo "✗ Backend: Unhealthy"
fi

# Frontend
if curl -sf http://localhost:3000 > /dev/null; then
    echo "✓ Frontend: Healthy"
else
    echo "✗ Frontend: Unhealthy"
fi

# PostgreSQL
if docker-compose exec -T db pg_isready -U nfadmin > /dev/null 2>&1; then
    echo "✓ PostgreSQL: Healthy"
else
    echo "✗ PostgreSQL: Unhealthy"
fi

# Redis
if docker-compose exec -T redis redis-cli --pass redis123 ping > /dev/null 2>&1; then
    echo "✓ Redis: Healthy"
else
    echo "✗ Redis: Unhealthy"
fi
```

---

## 10. Troubleshooting

### 10.1 Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in `.env` or stop conflicting service |
| Database connection refused | Wait for healthcheck, check credentials |
| Permission denied on volumes | Check file ownership, use `sudo` if needed |
| Container keeps restarting | Check logs: `docker-compose logs <service>` |
| Migrations fail | Ensure DB is running, check connection string |

### 10.2 Reset Everything

```bash
# Stop all containers
docker-compose down

# Remove all volumes (WARNING: deletes data)
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Fresh start
docker-compose up -d --build
```
