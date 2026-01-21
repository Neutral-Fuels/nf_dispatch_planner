# 02 - Database Schema Design

## 1. Overview

PostgreSQL 15 database with the following core entities:

- Users & Authentication
- Drivers
- Tankers
- Customers
- Emirates (reference)
- Fuel Blends (reference)
- Weekly Templates
- Daily Schedules
- Trips

---

## 2. Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │   emirates   │     │ fuel_blends  │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │     │ id           │     │ id           │
│ username     │     │ code         │     │ code         │
│ email        │     │ name         │     │ name         │
│ password_hash│     │ is_active    │     │ percentage   │
│ role         │     └──────────────┘     └──────────────┘
│ is_active    │            │                    │
└──────────────┘            │                    │
                            ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   drivers    │     │   tankers    │     │  customers   │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │     │ id           │     │ id           │
│ name         │     │ name         │     │ name         │
│ employee_id  │     │ registration │     │ code         │
│ driver_type  │     │ max_capacity │     │ customer_type│
│ contact_phone│     │ delivery_type│     │ fuel_blend_id│◄─┐
│ license_no   │     │ status       │     │ est_volume   │  │
│ is_active    │     │ is_3pl       │     │ emirate_id   │◄─┼─┐
└──────────────┘     │ is_active    │     │ is_active    │  │ │
       │             └──────────────┘     └──────────────┘  │ │
       │                    │                    │          │ │
       │                    ▼                    │          │ │
       │             ┌──────────────┐            │          │ │
       │             │tanker_blends │            │          │ │
       │             ├──────────────┤            │          │ │
       │             │ tanker_id    │◄───────────┼──────────┘ │
       │             │ fuel_blend_id│            │            │
       │             └──────────────┘            │            │
       │                    │                    │            │
       │             ┌──────────────┐            │            │
       │             │tanker_emirates            │            │
       │             ├──────────────┤            │            │
       │             │ tanker_id    │◄───────────┼────────────┘
       │             │ emirate_id   │            │
       │             └──────────────┘            │
       │                                         │
       ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────┐
│                    weekly_templates                       │
├──────────────────────────────────────────────────────────┤
│ id, customer_id, day_of_week (0-6), start_time, end_time │
│ tanker_id (nullable), fuel_blend_id, volume, is_mobile_op│
│ needs_return, notes, is_active                            │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    daily_schedules                        │
├──────────────────────────────────────────────────────────┤
│ id, schedule_date, generated_from_template, is_locked    │
│ created_by, created_at, updated_at                        │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                        trips                              │
├──────────────────────────────────────────────────────────┤
│ id, daily_schedule_id, template_id (nullable)            │
│ customer_id, tanker_id (nullable), driver_id (nullable)  │
│ start_time, end_time, fuel_blend_id, volume              │
│ is_mobile_op, needs_return, status, notes                 │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                   driver_schedules                        │
├──────────────────────────────────────────────────────────┤
│ id, driver_id, schedule_date, status (WORKING/OFF/HOL/F) │
│ notes                                                     │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Table Definitions

### 3.1 Reference Tables

```sql
-- Emirates (UAE regions)
CREATE TABLE emirates (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,      -- DXB, AUH, SHJ, AJM, RAK, FUJ, UAQ
    name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fuel Blends
CREATE TABLE fuel_blends (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,      -- B0, B5, B7, B10, B20, B100
    name VARCHAR(50) NOT NULL,             -- "Pure Diesel", "5% Biodiesel", etc.
    biodiesel_percentage INTEGER NOT NULL, -- 0, 5, 7, 10, 20, 100
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data for emirates
INSERT INTO emirates (code, name) VALUES
    ('DXB', 'Dubai'),
    ('AUH', 'Abu Dhabi'),
    ('SHJ', 'Sharjah'),
    ('AJM', 'Ajman'),
    ('RAK', 'Ras Al Khaimah'),
    ('FUJ', 'Fujairah'),
    ('UAQ', 'Umm Al Quwain');

-- Seed data for fuel blends
INSERT INTO fuel_blends (code, name, biodiesel_percentage) VALUES
    ('B0', 'Pure Diesel', 0),
    ('B5', '5% Biodiesel Blend', 5),
    ('B7', '7% Biodiesel Blend', 7),
    ('B10', '10% Biodiesel Blend', 10),
    ('B20', '20% Biodiesel Blend', 20),
    ('B100', 'Pure Biodiesel', 100);
```

### 3.2 Users Table

```sql
CREATE TYPE user_role AS ENUM ('admin', 'dispatcher', 'viewer');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default admin user (password: admin123 - MUST BE CHANGED)
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
    ('admin', 'admin@neutralfuels.com', 
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G/qGG8qkKyU2qu', 
     'System Administrator', 'admin');
```

### 3.3 Drivers Table

```sql
CREATE TYPE driver_type AS ENUM ('internal', '3pl');

CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) UNIQUE,
    driver_type driver_type NOT NULL DEFAULT 'internal',
    contact_phone VARCHAR(20),
    license_number VARCHAR(50),
    license_expiry DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for active drivers
CREATE INDEX idx_drivers_active ON drivers(is_active) WHERE is_active = TRUE;
```

### 3.4 Tankers Table

```sql
CREATE TYPE delivery_type AS ENUM ('bulk', 'mobile', 'both');
CREATE TYPE tanker_status AS ENUM ('active', 'maintenance', 'inactive');

CREATE TABLE tankers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,                    -- "TANKER 2", "3PL TANKER 7"
    registration VARCHAR(50),
    max_capacity INTEGER NOT NULL,                -- Liters
    delivery_type delivery_type NOT NULL,
    status tanker_status DEFAULT 'active',
    is_3pl BOOLEAN DEFAULT FALSE,
    default_driver_id INTEGER REFERENCES drivers(id),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tanker-Fuel Blend capabilities (many-to-many)
CREATE TABLE tanker_blends (
    tanker_id INTEGER REFERENCES tankers(id) ON DELETE CASCADE,
    fuel_blend_id INTEGER REFERENCES fuel_blends(id) ON DELETE CASCADE,
    PRIMARY KEY (tanker_id, fuel_blend_id)
);

-- Tanker-Emirate coverage (many-to-many)
CREATE TABLE tanker_emirates (
    tanker_id INTEGER REFERENCES tankers(id) ON DELETE CASCADE,
    emirate_id INTEGER REFERENCES emirates(id) ON DELETE CASCADE,
    PRIMARY KEY (tanker_id, emirate_id)
);
```

### 3.5 Customers Table

```sql
CREATE TYPE customer_type AS ENUM ('bulk', 'mobile');

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,           -- Short code: "AW", "DT-UM", etc.
    customer_type customer_type NOT NULL,
    fuel_blend_id INTEGER REFERENCES fuel_blends(id),
    estimated_volume INTEGER,                    -- Liters per delivery
    emirate_id INTEGER REFERENCES emirates(id),
    address TEXT,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for customer lookup by code
CREATE INDEX idx_customers_code ON customers(code);
CREATE INDEX idx_customers_active ON customers(is_active) WHERE is_active = TRUE;
```

### 3.6 Weekly Templates Table

```sql
CREATE TABLE weekly_templates (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        -- 0 = Saturday, 1 = Sunday, ... 5 = Thursday, 6 = Friday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    tanker_id INTEGER REFERENCES tankers(id),    -- NULL = "NOT ASSIGNED"
    fuel_blend_id INTEGER REFERENCES fuel_blends(id),
    volume INTEGER NOT NULL,                      -- Liters
    is_mobile_op BOOLEAN DEFAULT FALSE,           -- MO flag
    needs_return BOOLEAN DEFAULT FALSE,           -- Return to base flag
    priority INTEGER DEFAULT 0,                   -- For ordering
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Index for template lookup by day
CREATE INDEX idx_templates_day ON weekly_templates(day_of_week, is_active);
```

### 3.7 Daily Schedules Table

```sql
CREATE TABLE daily_schedules (
    id SERIAL PRIMARY KEY,
    schedule_date DATE NOT NULL UNIQUE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_locked BOOLEAN DEFAULT FALSE,              -- Prevent edits
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for date lookup
CREATE INDEX idx_schedules_date ON daily_schedules(schedule_date);
```

### 3.8 Trips Table

```sql
CREATE TYPE trip_status AS ENUM (
    'scheduled',      -- Normal scheduled trip
    'unassigned',     -- Tanker not assigned
    'conflict',       -- Constraint violation
    'completed',      -- Delivery completed
    'cancelled'       -- Cancelled
);

CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    daily_schedule_id INTEGER NOT NULL REFERENCES daily_schedules(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES weekly_templates(id),  -- Source template if generated
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    tanker_id INTEGER REFERENCES tankers(id),             -- NULL = unassigned
    driver_id INTEGER REFERENCES drivers(id),             -- NULL = unassigned
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    fuel_blend_id INTEGER REFERENCES fuel_blends(id),
    volume INTEGER NOT NULL,                               -- Liters
    is_mobile_op BOOLEAN DEFAULT FALSE,
    needs_return BOOLEAN DEFAULT FALSE,
    status trip_status DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_trip_time CHECK (end_time > start_time)
);

-- Indexes for trip queries
CREATE INDEX idx_trips_schedule ON trips(daily_schedule_id);
CREATE INDEX idx_trips_tanker ON trips(tanker_id, daily_schedule_id);
CREATE INDEX idx_trips_driver ON trips(driver_id, daily_schedule_id);
CREATE INDEX idx_trips_customer ON trips(customer_id);
CREATE INDEX idx_trips_status ON trips(status);
```

### 3.9 Driver Schedules Table

```sql
CREATE TYPE driver_status AS ENUM (
    'working',    -- Available for trips
    'off',        -- Day off
    'holiday',    -- HOL - Holiday/Leave
    'float'       -- F - Standby/Backup
);

CREATE TABLE driver_schedules (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id),
    schedule_date DATE NOT NULL,
    status driver_status NOT NULL DEFAULT 'working',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(driver_id, schedule_date)
);

-- Index for driver availability lookup
CREATE INDEX idx_driver_schedules_date ON driver_schedules(schedule_date, status);
```

### 3.10 Audit Log Table

```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,                  -- CREATE, UPDATE, DELETE
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for audit queries
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name, created_at);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at);
```

---

## 4. Key Constraints & Business Logic

### 4.1 Trip Assignment Validation

When assigning a tanker to a trip, validate:

```sql
-- Function to validate trip assignment
CREATE OR REPLACE FUNCTION validate_trip_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_tanker RECORD;
    v_customer RECORD;
    v_conflict INTEGER;
BEGIN
    -- If no tanker assigned, skip validation
    IF NEW.tanker_id IS NULL THEN
        NEW.status = 'unassigned';
        RETURN NEW;
    END IF;
    
    -- Get tanker details
    SELECT * INTO v_tanker FROM tankers WHERE id = NEW.tanker_id;
    
    -- Get customer details
    SELECT * INTO v_customer FROM customers WHERE id = NEW.customer_id;
    
    -- Check capacity
    IF NEW.volume > v_tanker.max_capacity THEN
        RAISE EXCEPTION 'Tanker capacity (%) insufficient for volume (%)', 
            v_tanker.max_capacity, NEW.volume;
    END IF;
    
    -- Check fuel blend compatibility
    IF NOT EXISTS (
        SELECT 1 FROM tanker_blends 
        WHERE tanker_id = NEW.tanker_id 
        AND fuel_blend_id = NEW.fuel_blend_id
    ) THEN
        RAISE EXCEPTION 'Tanker does not support this fuel blend';
    END IF;
    
    -- Check delivery type compatibility
    IF (v_customer.customer_type = 'bulk' AND v_tanker.delivery_type = 'mobile')
       OR (v_customer.customer_type = 'mobile' AND v_tanker.delivery_type = 'bulk') THEN
        RAISE EXCEPTION 'Tanker delivery type incompatible with customer type';
    END IF;
    
    -- Check emirate coverage
    IF NOT EXISTS (
        SELECT 1 FROM tanker_emirates 
        WHERE tanker_id = NEW.tanker_id 
        AND emirate_id = v_customer.emirate_id
    ) THEN
        RAISE EXCEPTION 'Tanker does not cover customer emirate';
    END IF;
    
    -- Check for time conflicts with same tanker
    SELECT COUNT(*) INTO v_conflict
    FROM trips t
    JOIN daily_schedules ds ON t.daily_schedule_id = ds.id
    WHERE t.tanker_id = NEW.tanker_id
    AND ds.id = NEW.daily_schedule_id
    AND t.id != COALESCE(NEW.id, 0)
    AND (
        (NEW.start_time, NEW.end_time) OVERLAPS (t.start_time, t.end_time)
    );
    
    IF v_conflict > 0 THEN
        NEW.status = 'conflict';
    ELSE
        NEW.status = 'scheduled';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_trip
BEFORE INSERT OR UPDATE ON trips
FOR EACH ROW
EXECUTE FUNCTION validate_trip_assignment();
```

### 4.2 Driver Availability Check

```sql
-- Function to check if driver is available
CREATE OR REPLACE FUNCTION is_driver_available(
    p_driver_id INTEGER,
    p_date DATE
) RETURNS BOOLEAN AS $$
DECLARE
    v_status driver_status;
BEGIN
    SELECT status INTO v_status
    FROM driver_schedules
    WHERE driver_id = p_driver_id
    AND schedule_date = p_date;
    
    -- If no record, assume working
    IF v_status IS NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN v_status IN ('working', 'float');
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Views

### 5.1 Daily Schedule Overview

```sql
CREATE VIEW vw_daily_schedule_overview AS
SELECT 
    ds.id AS schedule_id,
    ds.schedule_date,
    ds.day_of_week,
    t.id AS trip_id,
    c.code AS customer_code,
    c.name AS customer_name,
    tk.name AS tanker_name,
    d.name AS driver_name,
    t.start_time,
    t.end_time,
    fb.code AS fuel_blend,
    t.volume,
    t.is_mobile_op,
    t.status
FROM daily_schedules ds
JOIN trips t ON t.daily_schedule_id = ds.id
JOIN customers c ON t.customer_id = c.id
LEFT JOIN tankers tk ON t.tanker_id = tk.id
LEFT JOIN drivers d ON t.driver_id = d.id
LEFT JOIN fuel_blends fb ON t.fuel_blend_id = fb.id
ORDER BY ds.schedule_date, t.start_time;
```

### 5.2 Tanker Availability

```sql
CREATE VIEW vw_tanker_availability AS
SELECT 
    tk.id AS tanker_id,
    tk.name AS tanker_name,
    tk.max_capacity,
    tk.delivery_type,
    ds.schedule_date,
    COALESCE(
        STRING_AGG(
            t.start_time::TEXT || '-' || t.end_time::TEXT, 
            ', ' ORDER BY t.start_time
        ),
        'Available all day'
    ) AS booked_slots
FROM tankers tk
CROSS JOIN daily_schedules ds
LEFT JOIN trips t ON t.tanker_id = tk.id 
    AND t.daily_schedule_id = ds.id
WHERE tk.is_active = TRUE
GROUP BY tk.id, tk.name, tk.max_capacity, tk.delivery_type, ds.schedule_date;
```

---

## 6. Migration Strategy

### 6.1 Alembic Configuration

```python
# alembic/env.py
from app.models import Base
from app.config import settings

target_metadata = Base.metadata

def run_migrations_online():
    connectable = create_engine(settings.DATABASE_URL)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()
```

### 6.2 Initial Migration

```bash
# Generate initial migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

---

## 7. Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| drivers | idx_drivers_active | Quick lookup of active drivers |
| customers | idx_customers_code | Fast customer code search |
| customers | idx_customers_active | Active customer filtering |
| weekly_templates | idx_templates_day | Template lookup by weekday |
| daily_schedules | idx_schedules_date | Date-based schedule lookup |
| trips | idx_trips_schedule | Trips per schedule |
| trips | idx_trips_tanker | Tanker utilization queries |
| trips | idx_trips_driver | Driver assignment queries |
| driver_schedules | idx_driver_schedules_date | Availability checks |
| audit_logs | idx_audit_logs_table | Audit trail queries |
