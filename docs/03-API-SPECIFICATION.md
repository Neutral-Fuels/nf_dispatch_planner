# 03 - API Specification

## 1. Overview

RESTful API built with FastAPI (Python 3.11+) providing:

- JWT-based authentication
- OpenAPI/Swagger documentation
- JSON request/response format
- Standard HTTP status codes

**Base URL:** `http://localhost:8000/api/v1`

---

## 2. Authentication

### 2.1 Login

```
POST /auth/login
```

**Request:**

```json
{
    "username": "admin",
    "password": "admin123"
}
```

**Response (200):**

```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 86400,
    "user": {
        "id": 1,
        "username": "admin",
        "email": "admin@neutralfuels.com",
        "full_name": "System Administrator",
        "role": "admin"
    }
}
```

**Error (401):**

```json
{
    "detail": "Invalid username or password"
}
```

### 2.2 Get Current User

```
GET /auth/me
Authorization: Bearer {token}
```

**Response (200):**

```json
{
    "id": 1,
    "username": "admin",
    "email": "admin@neutralfuels.com",
    "full_name": "System Administrator",
    "role": "admin",
    "last_login": "2025-01-20T08:30:00Z"
}
```

### 2.3 Change Password

```
POST /auth/change-password
Authorization: Bearer {token}
```

**Request:**

```json
{
    "current_password": "oldpassword",
    "new_password": "newpassword123"
}
```

---

## 3. User Management

**Requires:** Admin role

### 3.1 List Users

```
GET /users
GET /users?role=dispatcher&is_active=true
```

**Response:**

```json
{
    "items": [
        {
            "id": 1,
            "username": "admin",
            "email": "admin@neutralfuels.com",
            "full_name": "System Administrator",
            "role": "admin",
            "is_active": true,
            "last_login": "2025-01-20T08:30:00Z"
        }
    ],
    "total": 1,
    "page": 1,
    "pages": 1
}
```

### 3.2 Create User

```
POST /users
```

**Request:**

```json
{
    "username": "dispatcher1",
    "email": "dispatcher1@neutralfuels.com",
    "password": "tempPassword123",
    "full_name": "John Smith",
    "role": "dispatcher"
}
```

### 3.3 Update User

```
PUT /users/{user_id}
```

### 3.4 Deactivate User

```
DELETE /users/{user_id}
```

*Note: Soft delete - sets is_active = false*

---

## 4. Driver Management

### 4.1 List Drivers

```
GET /drivers
GET /drivers?type=internal&is_active=true
```

**Response:**

```json
{
    "items": [
        {
            "id": 1,
            "name": "Irfan",
            "employee_id": "NF-001",
            "driver_type": "internal",
            "contact_phone": "+971501234567",
            "license_number": "DXB-12345",
            "license_expiry": "2026-05-15",
            "is_active": true
        }
    ],
    "total": 15,
    "page": 1,
    "pages": 1
}
```

### 4.2 Create Driver

```
POST /drivers
```

**Request:**

```json
{
    "name": "Ahmed",
    "employee_id": "NF-016",
    "driver_type": "internal",
    "contact_phone": "+971501234567",
    "license_number": "DXB-67890",
    "license_expiry": "2026-12-31"
}
```

### 4.3 Get Driver

```
GET /drivers/{driver_id}
```

### 4.4 Update Driver

```
PUT /drivers/{driver_id}
```

### 4.5 Delete Driver

```
DELETE /drivers/{driver_id}
```

### 4.6 Get Driver Schedule

```
GET /drivers/{driver_id}/schedule?month=2025-01
```

**Response:**

```json
{
    "driver_id": 1,
    "driver_name": "Irfan",
    "month": "2025-01",
    "schedule": [
        {
            "date": "2025-01-01",
            "day_of_week": 3,
            "status": "working",
            "trips": [
                {
                    "trip_id": 101,
                    "customer_code": "FAR",
                    "tanker_name": "TANKER 3",
                    "start_time": "08:00",
                    "end_time": "11:00"
                }
            ]
        }
    ]
}
```

### 4.7 Set Driver Availability

```
POST /drivers/{driver_id}/schedule
```

**Request:**

```json
{
    "date": "2025-01-15",
    "status": "off",
    "notes": "Requested day off"
}
```

### 4.8 Bulk Set Driver Schedule

```
POST /drivers/schedule/bulk
```

**Request:**

```json
{
    "driver_id": 1,
    "start_date": "2025-01-01",
    "end_date": "2025-01-31",
    "pattern": ["working", "working", "working", "working", "working", "off", "off"]
}
```

---

## 5. Tanker Management

### 5.1 List Tankers

```
GET /tankers
GET /tankers?delivery_type=mobile&status=active
```

**Response:**

```json
{
    "items": [
        {
            "id": 1,
            "name": "TANKER 2",
            "registration": "DXB-12345",
            "max_capacity": 6000,
            "delivery_type": "both",
            "status": "active",
            "is_3pl": false,
            "fuel_blends": ["B5", "B20"],
            "emirates": ["DXB", "SHJ", "AJM"],
            "default_driver": {
                "id": 1,
                "name": "Irfan"
            }
        }
    ],
    "total": 10
}
```

### 5.2 Create Tanker

```
POST /tankers
```

**Request:**

```json
{
    "name": "TANKER 7",
    "registration": "DXB-99999",
    "max_capacity": 5000,
    "delivery_type": "mobile",
    "is_3pl": true,
    "fuel_blend_ids": [1, 2],
    "emirate_ids": [1, 2, 3],
    "default_driver_id": 5
}
```

### 5.3 Get Tanker

```
GET /tankers/{tanker_id}
```

### 5.4 Update Tanker

```
PUT /tankers/{tanker_id}
```

### 5.5 Delete Tanker

```
DELETE /tankers/{tanker_id}
```

### 5.6 Get Tanker Availability

```
GET /tankers/{tanker_id}/availability?date=2025-01-15
```

**Response:**

```json
{
    "tanker_id": 1,
    "tanker_name": "TANKER 2",
    "date": "2025-01-15",
    "booked_slots": [
        {"start": "05:00", "end": "06:00", "customer": "GMA"},
        {"start": "10:00", "end": "11:00", "customer": "DEL"}
    ],
    "available_slots": [
        {"start": "00:00", "end": "05:00"},
        {"start": "06:00", "end": "10:00"},
        {"start": "11:00", "end": "23:59"}
    ]
}
```

### 5.7 Get Compatible Tankers for Trip

```
GET /tankers/compatible?customer_id=5&volume=2000&fuel_blend_id=2
```

**Response:**

```json
{
    "compatible_tankers": [
        {
            "id": 1,
            "name": "TANKER 2",
            "max_capacity": 6000,
            "delivery_type": "both"
        },
        {
            "id": 4,
            "name": "TANKER 4",
            "max_capacity": 6000,
            "delivery_type": "both"
        }
    ]
}
```

---

## 6. Customer Management

### 6.1 List Customers

```
GET /customers
GET /customers?type=mobile&emirate_id=1&is_active=true
```

**Response:**

```json
{
    "items": [
        {
            "id": 1,
            "name": "Al Wegdaniyah",
            "code": "AW",
            "customer_type": "mobile",
            "fuel_blend": {"id": 1, "code": "B0"},
            "estimated_volume": 1500,
            "emirate": {"id": 1, "code": "DXB", "name": "Dubai"},
            "contact_name": "John Smith",
            "contact_phone": "+971501234567",
            "is_active": true
        }
    ],
    "total": 35
}
```

### 6.2 Create Customer

```
POST /customers
```

**Request:**

```json
{
    "name": "New Customer LLC",
    "code": "NC",
    "customer_type": "bulk",
    "fuel_blend_id": 2,
    "estimated_volume": 3000,
    "emirate_id": 1,
    "address": "Industrial Area 5, Dubai",
    "contact_name": "Jane Doe",
    "contact_phone": "+971507654321",
    "contact_email": "jane@newcustomer.com"
}
```

### 6.3 Get Customer

```
GET /customers/{customer_id}
```

### 6.4 Update Customer

```
PUT /customers/{customer_id}
```

### 6.5 Delete Customer

```
DELETE /customers/{customer_id}
```

### 6.6 Get Customer Schedule

```
GET /customers/{customer_id}/schedule
```

**Response:**

```json
{
    "customer_id": 1,
    "customer_name": "Al Wegdaniyah",
    "weekly_templates": [
        {
            "id": 1,
            "day_of_week": 0,
            "day_name": "Saturday",
            "start_time": "14:00",
            "end_time": "16:00",
            "tanker_name": "NOT ASSIGNED",
            "volume": 1500,
            "fuel_blend": "B0"
        }
    ]
}
```

---

## 7. Weekly Templates

### 7.1 List Templates

```
GET /templates
GET /templates?day_of_week=0&customer_id=1
```

**Response:**

```json
{
    "items": [
        {
            "id": 1,
            "customer": {"id": 1, "code": "AW", "name": "Al Wegdaniyah"},
            "day_of_week": 0,
            "day_name": "Saturday",
            "start_time": "14:00",
            "end_time": "16:00",
            "tanker": null,
            "fuel_blend": {"id": 1, "code": "B0"},
            "volume": 1500,
            "is_mobile_op": true,
            "needs_return": false,
            "is_active": true
        }
    ],
    "total": 50
}
```

### 7.2 Create Template

```
POST /templates
```

**Request:**

```json
{
    "customer_id": 1,
    "day_of_week": 0,
    "start_time": "08:00",
    "end_time": "10:00",
    "tanker_id": null,
    "fuel_blend_id": 1,
    "volume": 1500,
    "is_mobile_op": true,
    "needs_return": false
}
```

### 7.3 Get Templates by Day

```
GET /templates/day/{day_of_week}
```

**Response:**

```json
{
    "day_of_week": 0,
    "day_name": "Saturday",
    "templates": [...]
}
```

### 7.4 Update Template

```
PUT /templates/{template_id}
```

### 7.5 Delete Template

```
DELETE /templates/{template_id}
```

---

## 8. Daily Schedules

### 8.1 Get Schedule for Date

```
GET /schedules/{date}
GET /schedules/2025-01-15
```

**Response:**

```json
{
    "id": 1,
    "schedule_date": "2025-01-15",
    "day_of_week": 3,
    "day_name": "Wednesday",
    "is_locked": false,
    "trips": [
        {
            "id": 101,
            "customer": {"id": 1, "code": "GMA", "name": "GMA"},
            "tanker": {"id": 1, "name": "TANKER 2"},
            "driver": {"id": 1, "name": "Irfan"},
            "start_time": "05:00",
            "end_time": "06:00",
            "fuel_blend": {"id": 2, "code": "B5"},
            "volume": 5000,
            "is_mobile_op": false,
            "status": "scheduled"
        }
    ],
    "summary": {
        "total_trips": 25,
        "assigned_trips": 22,
        "unassigned_trips": 3,
        "conflict_trips": 0,
        "total_volume": 75000
    }
}
```

### 8.2 Generate Schedule from Template

```
POST /schedules/{date}/generate
```

**Request:**

```json
{
    "overwrite_existing": false
}
```

**Response:**

```json
{
    "schedule_id": 1,
    "schedule_date": "2025-01-15",
    "trips_created": 25,
    "trips_skipped": 0,
    "message": "Schedule generated successfully"
}
```

### 8.3 Get Schedule Timeline View

```
GET /schedules/{date}/timeline
```

**Response:**

```json
{
    "date": "2025-01-15",
    "time_slots": ["00:00", "00:30", "01:00", ...],
    "tankers": [
        {
            "id": 1,
            "name": "TANKER 2",
            "slots": {
                "05:00": {"trip_id": 101, "customer": "GMA", "status": "scheduled"},
                "05:30": {"trip_id": 101, "customer": "GMA", "status": "scheduled"},
                "10:00": {"trip_id": 102, "customer": "DEL", "status": "scheduled"}
            }
        }
    ]
}
```

### 8.4 Lock/Unlock Schedule

```
POST /schedules/{date}/lock
POST /schedules/{date}/unlock
```

---

## 9. Trip Management

### 9.1 Create Trip

```
POST /schedules/{date}/trips
```

**Request:**

```json
{
    "customer_id": 1,
    "tanker_id": null,
    "driver_id": null,
    "start_time": "14:00",
    "end_time": "16:00",
    "fuel_blend_id": 1,
    "volume": 1500,
    "is_mobile_op": true,
    "notes": "Ad-hoc delivery"
}
```

### 9.2 Update Trip

```
PUT /trips/{trip_id}
```

**Request:**

```json
{
    "tanker_id": 2,
    "driver_id": 3,
    "start_time": "15:00",
    "end_time": "17:00"
}
```

### 9.3 Assign Tanker to Trip

```
PATCH /trips/{trip_id}/assign-tanker
```

**Request:**

```json
{
    "tanker_id": 2
}
```

**Response (200):**

```json
{
    "trip_id": 101,
    "tanker_id": 2,
    "status": "scheduled",
    "message": "Tanker assigned successfully"
}
```

**Response (400 - Validation Error):**

```json
{
    "detail": "Tanker capacity (4000L) insufficient for volume (5000L)"
}
```

### 9.4 Assign Driver to Trip

```
PATCH /trips/{trip_id}/assign-driver
```

**Request:**

```json
{
    "driver_id": 3
}
```

### 9.5 Delete Trip

```
DELETE /trips/{trip_id}
```

### 9.6 Bulk Update Trips

```
PATCH /schedules/{date}/trips/bulk
```

**Request:**

```json
{
    "trip_ids": [101, 102, 103],
    "updates": {
        "tanker_id": 2
    }
}
```

---

## 10. Driver Trip Sheets

### 10.1 Get Driver Trip Sheet

```
GET /drivers/{driver_id}/trip-sheet?start_date=2025-01-13&end_date=2025-01-19
```

**Response:**

```json
{
    "driver": {"id": 1, "name": "Irfan"},
    "period": {
        "start_date": "2025-01-13",
        "end_date": "2025-01-19"
    },
    "days": [
        {
            "date": "2025-01-13",
            "day_name": "Monday",
            "status": "working",
            "trips": [
                {
                    "trip_id": 201,
                    "customer_code": "GMA",
                    "customer_name": "GMA",
                    "tanker_name": "TANKER 2",
                    "start_time": "05:00",
                    "end_time": "06:00",
                    "fuel_blend": "B5",
                    "volume": 5000,
                    "location": "Dubai"
                }
            ]
        }
    ],
    "summary": {
        "total_trips": 15,
        "total_volume": 45000,
        "working_days": 5
    }
}
```

### 10.2 Export Driver Trip Sheet as PDF

```
GET /drivers/{driver_id}/trip-sheet/pdf?start_date=2025-01-13&end_date=2025-01-19
```

**Response:** PDF file download

---

## 11. Reference Data

### 11.1 Get Emirates

```
GET /reference/emirates
```

**Response:**

```json
[
    {"id": 1, "code": "DXB", "name": "Dubai"},
    {"id": 2, "code": "AUH", "name": "Abu Dhabi"},
    ...
]
```

### 11.2 Get Fuel Blends

```
GET /reference/fuel-blends
```

**Response:**

```json
[
    {"id": 1, "code": "B0", "name": "Pure Diesel", "percentage": 0},
    {"id": 2, "code": "B5", "name": "5% Biodiesel Blend", "percentage": 5},
    ...
]
```

---

## 12. Dashboard & Reports

### 12.1 Today's Summary

```
GET /dashboard/today
```

**Response:**

```json
{
    "date": "2025-01-20",
    "day_name": "Monday",
    "schedule_status": "generated",
    "trips": {
        "total": 28,
        "scheduled": 24,
        "unassigned": 3,
        "conflicts": 1,
        "completed": 0
    },
    "volume": {
        "total_planned": 85000,
        "total_delivered": 0
    },
    "drivers": {
        "working": 10,
        "off": 3,
        "float": 2
    },
    "tankers": {
        "active": 8,
        "maintenance": 1,
        "idle": 1
    },
    "alerts": [
        {
            "type": "unassigned",
            "message": "3 trips have no tanker assigned",
            "trip_ids": [101, 105, 112]
        }
    ]
}
```

### 12.2 Weekly Overview

```
GET /dashboard/week?start_date=2025-01-13
```

---

## 13. Error Responses

### Standard Error Format

```json
{
    "detail": "Error message here",
    "code": "ERROR_CODE",
    "errors": [
        {"field": "volume", "message": "Must be greater than 0"}
    ]
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/expired token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (e.g., duplicate entry) |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

---

## 14. Rate Limiting

- 100 requests per minute per user
- Bulk operations count as 1 request

**Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705747200
```

---

## 15. Pagination

All list endpoints support pagination:

```
GET /customers?page=1&per_page=20
```

**Response:**

```json
{
    "items": [...],
    "total": 100,
    "page": 1,
    "per_page": 20,
    "pages": 5
}
```
