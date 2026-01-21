# 01 - Requirements Specification

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the NF Dispatch Planner, a web-based fuel delivery scheduling system for Neutral Fuels UAE.

### 1.2 Scope

The system replaces the existing Excel-based scheduling workbook with a modern web application supporting multi-user access, real-time updates, and intelligent constraint validation.

### 1.3 Business Context

Neutral Fuels operates a fleet of tankers delivering biodiesel (various blends) to customers across the UAE. The scheduling process involves:

- Managing driver shifts on a rotating weekly/monthly basis
- Assigning tankers to delivery trips based on constraints
- Planning recurring weekly schedules for regular customers
- Generating daily operational schedules

---

## 2. Functional Requirements

### 2.1 User Management (FR-UM)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-UM-01 | System shall support user authentication via username/password | Must |
| FR-UM-02 | System shall NOT provide public signup; users created by admin only | Must |
| FR-UM-03 | System shall support three roles: Admin, Dispatcher, Viewer | Must |
| FR-UM-04 | Admin shall be able to create, edit, deactivate user accounts | Must |
| FR-UM-05 | System shall provide a default admin account on first deployment | Must |
| FR-UM-06 | Users shall be able to change their own password | Should |
| FR-UM-07 | System shall lock accounts after 5 failed login attempts | Should |
| FR-UM-08 | Sessions shall expire after 8 hours of inactivity | Should |

**Role Permissions:**

| Feature | Admin | Dispatcher | Viewer |
|---------|-------|------------|--------|
| View schedules | ✓ | ✓ | ✓ |
| Edit schedules | ✓ | ✓ | ✗ |
| Manage drivers | ✓ | ✓ | ✗ |
| Manage tankers | ✓ | ✓ | ✗ |
| Manage customers | ✓ | ✓ | ✗ |
| Manage users | ✓ | ✗ | ✗ |
| System settings | ✓ | ✗ | ✗ |

---

### 2.2 Driver Management (FR-DM)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DM-01 | System shall maintain a pool of drivers | Must |
| FR-DM-02 | Each driver record shall include: name, employee ID, contact, license info | Must |
| FR-DM-03 | System shall support driver types: Internal, 3PL (third-party logistics) | Must |
| FR-DM-04 | System shall track driver shift status: Working, OFF, Holiday, Float | Must |
| FR-DM-05 | System shall support monthly rotating shift patterns | Must |
| FR-DM-06 | Dispatcher shall be able to set driver availability per day | Must |
| FR-DM-07 | System shall prevent assigning trips to unavailable drivers | Must |
| FR-DM-08 | System shall generate printable driver sheets with weekly assignments | Should |

**Driver Status Types:**

- **Working** - Driver available for trips
- **OFF** - Scheduled day off
- **HOL** - Holiday/Leave
- **F (Float)** - Available as backup/standby

---

### 2.3 Tanker Management (FR-TM)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TM-01 | System shall maintain a fleet of tankers | Must |
| FR-TM-02 | Each tanker shall have: name, registration, max capacity (liters) | Must |
| FR-TM-03 | Each tanker shall specify supported fuel blends (B0, B5, B7, B10, B20, B100) | Must |
| FR-TM-04 | Each tanker shall specify delivery type: Bulk, Mobile, or Both | Must |
| FR-TM-05 | Each tanker shall specify covered emirates (Dubai, Abu Dhabi, Sharjah, Ajman, RAK, Fujairah, UAQ) | Must |
| FR-TM-06 | System shall support internal tankers and 3PL tankers | Must |
| FR-TM-07 | Tanker shall have status: Active, Under Maintenance, Inactive | Should |
| FR-TM-08 | System shall track tanker-driver assignments (default driver) | Could |

**Constraint Logic:**

- Tanker can only be assigned to customer if:
  1. Tanker capacity ≥ Customer required volume
  2. Tanker supports customer's required fuel blend
  3. Tanker delivery type matches customer type (Bulk/Mobile)
  4. Tanker covers customer's emirate

---

### 2.4 Customer Management (FR-CM)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CM-01 | System shall maintain a customer pool | Must |
| FR-CM-02 | Each customer shall have: name, code (short identifier), contact info | Must |
| FR-CM-03 | Each customer shall specify type: Bulk (Tank) or Mobile | Must |
| FR-CM-04 | Each customer shall specify required fuel blend | Must |
| FR-CM-05 | Each customer shall specify estimated volume per delivery (liters) | Must |
| FR-CM-06 | Each customer shall specify location emirate | Must |
| FR-CM-07 | Customer may have multiple locations (e.g., "Dnata - Ajman", "Dnata - JAFZA") | Should |
| FR-CM-08 | Customer shall have status: Active, Inactive, Suspended | Should |

**Customer Types:**

- **Tank (Bulk)**: Fixed storage tank, requires bulk delivery truck
- **Mobile**: On-site refueling, requires mobile refueling system

---

### 2.5 Weekly Schedule Templates (FR-WT)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-WT-01 | System shall support recurring weekly schedule templates (Sat-Fri) | Must |
| FR-WT-02 | Each template trip shall specify: customer, day of week, time window, tanker, volume | Must |
| FR-WT-03 | Same customer can have multiple trips on same day at different times | Must |
| FR-WT-04 | Same customer can have trips on different days of the week | Must |
| FR-WT-05 | Template trips may have tanker as "NOT ASSIGNED" for later assignment | Must |
| FR-WT-06 | Template shall support time windows with start/end times | Must |
| FR-WT-07 | Template shall specify if trip is Mobile Operation (MO flag) | Should |
| FR-WT-08 | Template shall specify if tanker needs to return to base after delivery | Could |

---

### 2.6 Daily Schedule Management (FR-DS)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DS-01 | User shall select a date to view/generate daily schedule | Must |
| FR-DS-02 | System shall auto-generate daily schedule from weekly template | Must |
| FR-DS-03 | Generated schedule shall be editable for date-specific adjustments | Must |
| FR-DS-04 | Daily view shall show visual timeline (Gantt-style) with tankers as rows | Must |
| FR-DS-05 | Daily view shall show trip list in tabular format | Must |
| FR-DS-06 | Trips shall be color-coded by status: Assigned, Unassigned, Conflict | Should |
| FR-DS-07 | User shall be able to drag-and-drop trips to reassign tankers | Should |
| FR-DS-08 | System shall validate all constraints when saving schedule | Must |
| FR-DS-09 | System shall detect time conflicts (overlapping trips for same tanker) | Must |
| FR-DS-10 | System shall support adding ad-hoc trips not in template | Must |

---

### 2.7 Driver Schedule View (FR-DV)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DV-01 | System shall display monthly driver schedule (like Excel sheets) | Must |
| FR-DV-02 | View shall show drivers as rows, days/hours as columns | Must |
| FR-DV-03 | Cells shall display trip codes or status (OFF, HOL, F) | Must |
| FR-DV-04 | User shall be able to filter by month and adjust rotation | Must |
| FR-DV-05 | System shall link trips to assigned drivers automatically | Should |
| FR-DV-06 | Driver schedule shall be exportable to PDF/Excel | Should |

---

### 2.8 Driver Trip Sheet (FR-TS)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TS-01 | System shall generate individual driver sheets | Must |
| FR-TS-02 | Sheet shall list all trips assigned to driver for selected period | Must |
| FR-TS-03 | Each trip shall show: customer, time, tanker, volume, blend, location | Must |
| FR-TS-04 | Sheet shall be printable in A4 format | Should |
| FR-TS-05 | Sheet shall be exportable as PDF | Should |

---

### 2.9 Reporting (FR-RP)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-RP-01 | Dashboard shall show today's delivery summary | Should |
| FR-RP-02 | Report: Unassigned trips requiring attention | Should |
| FR-RP-03 | Report: Tanker utilization per day/week | Could |
| FR-RP-04 | Report: Driver workload distribution | Could |

---

## 3. Non-Functional Requirements

### 3.1 Performance (NFR-PF)

| ID | Requirement |
|----|-------------|
| NFR-PF-01 | Page load time shall be under 3 seconds |
| NFR-PF-02 | API response time shall be under 500ms for standard operations |
| NFR-PF-03 | System shall support up to 20 concurrent users |

### 3.2 Security (NFR-SC)

| ID | Requirement |
|----|-------------|
| NFR-SC-01 | All passwords shall be hashed using bcrypt |
| NFR-SC-02 | All API endpoints shall require authentication (except login) |
| NFR-SC-03 | HTTPS shall be used in production |
| NFR-SC-04 | JWT tokens shall expire after 24 hours |
| NFR-SC-05 | SQL injection and XSS prevention shall be implemented |

### 3.3 Availability (NFR-AV)

| ID | Requirement |
|----|-------------|
| NFR-AV-01 | System shall be available 99% during business hours (6am-10pm GST) |
| NFR-AV-02 | Database shall be backed up daily |
| NFR-AV-03 | System shall support zero-downtime deployments |

### 3.4 Scalability (NFR-SC)

| ID | Requirement |
|----|-------------|
| NFR-SC-01 | System shall handle 50+ drivers, 20+ tankers, 100+ customers |
| NFR-SC-02 | System shall retain 2 years of schedule history |

### 3.5 Usability (NFR-US)

| ID | Requirement |
|----|-------------|
| NFR-US-01 | Interface shall be responsive (desktop, tablet) |
| NFR-US-02 | Interface shall support Chrome, Firefox, Edge browsers |
| NFR-US-03 | Interface shall follow consistent design patterns |

### 3.6 Maintainability (NFR-MT)

| ID | Requirement |
|----|-------------|
| NFR-MT-01 | Code shall follow established style guides (PEP8, ESLint) |
| NFR-MT-02 | API shall be documented via OpenAPI/Swagger |
| NFR-MT-03 | Database migrations shall be version-controlled |

---

## 4. Data Migration

### 4.1 Initial Data Load

The following data from the existing Excel workbook needs to be migrated:

| Data Type | Source Sheet | Records (approx) |
|-----------|--------------|------------------|
| Customers | DataSheet | ~35 |
| Tankers | DataSheet | ~10 |
| Drivers | DataSheet | ~15 |
| Weekly Templates | Saturday-Friday sheets | ~50 trips/day |

### 4.2 Migration Script Requirements

- Parse Excel file and validate data
- Create seed data files (JSON/SQL)
- Handle duplicate customer entries
- Preserve existing customer codes (CUS_CODE)
- Map tanker names consistently

---

## 5. Assumptions & Dependencies

### 5.1 Assumptions

1. UAE work week is Saturday to Friday
2. Scheduling operates on 30-minute time slots
3. All times are in GST (UTC+4)
4. 3PL drivers/tankers follow same scheduling rules as internal

### 5.2 Dependencies

1. Docker and Docker Compose available on deployment server
2. PostgreSQL 15+ compatible environment
3. Modern web browser support required
4. Network connectivity between services

---

## 6. Glossary

| Term | Definition |
|------|------------|
| 3PL | Third-Party Logistics - outsourced drivers/tankers |
| Blend | Biodiesel mixture ratio (B5 = 5% biodiesel, B20 = 20%, etc.) |
| Bulk Delivery | Delivery to fixed storage tank |
| Mobile Refueling | On-site vehicle refueling using mobile system |
| MO Flag | Mobile Operation indicator |
| Float (F) | Driver on standby/backup status |
| Trip | Single delivery assignment (customer + time + tanker) |
| Template | Recurring weekly schedule pattern |
