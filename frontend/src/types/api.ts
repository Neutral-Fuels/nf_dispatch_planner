// Common API response types

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface ApiError {
  detail: string
  code?: string
  errors?: Array<{
    field: string
    message: string
  }>
}

// Reference data types
export interface Emirate {
  id: number
  code: string
  name: string
}

export interface FuelBlend {
  id: number
  code: string
  name: string
  biodiesel_percentage: number
}

// Driver types
export type DriverType = 'internal' | '3pl'
export type DriverStatus = 'working' | 'off' | 'holiday' | 'float'

export interface Driver {
  id: number
  name: string
  employee_id: string | null
  driver_type: DriverType
  contact_phone: string | null
  license_number: string | null
  license_expiry: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

// Tanker types
export type DeliveryType = 'bulk' | 'mobile' | 'both'
export type TankerStatus = 'active' | 'maintenance' | 'inactive'

export interface Tanker {
  id: number
  name: string
  registration: string | null
  max_capacity: number
  delivery_type: DeliveryType
  status: TankerStatus
  is_3pl: boolean
  fuel_blends: FuelBlend[]
  emirates: Emirate[]
  default_driver: { id: number; name: string } | null
  notes: string | null
  is_active: boolean
  created_at: string
}

// Customer types
export type CustomerType = 'bulk' | 'mobile'

export interface Customer {
  id: number
  name: string
  code: string
  customer_type: CustomerType
  fuel_blend: FuelBlend | null
  estimated_volume: number | null
  emirate: Emirate | null
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

// Schedule types
export type TripStatus = 'scheduled' | 'unassigned' | 'conflict' | 'completed' | 'cancelled'

export interface Trip {
  id: number
  daily_schedule_id: number
  template_id: number | null
  customer: { id: number; code: string; name: string }
  tanker: { id: number; name: string } | null
  driver: { id: number; name: string } | null
  start_time: string
  end_time: string
  fuel_blend: { id: number; code: string } | null
  volume: number
  is_mobile_op: boolean
  needs_return: boolean
  status: TripStatus
  notes: string | null
  created_at: string
}

export interface ScheduleSummary {
  total_trips: number
  assigned_trips: number
  unassigned_trips: number
  conflict_trips: number
  total_volume: number
}

export interface DailySchedule {
  id: number | null
  schedule_date: string
  day_of_week: number
  day_name: string
  is_locked: boolean
  trips: Trip[]
  summary: ScheduleSummary
  notes: string | null
  created_at: string | null
}

export interface WeeklyTemplate {
  id: number
  customer: { id: number; code: string; name: string }
  day_of_week: number
  day_name: string
  start_time: string
  end_time: string
  tanker: { id: number; name: string } | null
  fuel_blend: { id: number; code: string } | null
  volume: number
  is_mobile_op: boolean
  needs_return: boolean
  priority: number
  notes: string | null
  is_active: boolean
  created_at: string
}

// User types
export type UserRole = 'admin' | 'dispatcher' | 'viewer'

export interface User {
  id: number
  username: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  last_login: string | null
  created_at: string
}

// Trip Group types
export interface TemplateBasic {
  id: number
  customer: { id: number; code: string; name: string }
  day_of_week: number
  day_name: string
  start_time: string
  end_time: string
  volume: number
  tanker: { id: number; name: string } | null
}

export interface TripGroup {
  id: number
  name: string
  day_of_week: number
  day_name: string
  description: string | null
  is_active: boolean
  templates: TemplateBasic[]
  template_count: number
  created_at: string
  updated_at: string
}

export interface TripGroupListItem {
  id: number
  name: string
  day_of_week: number
  day_name: string
  description: string | null
  is_active: boolean
  template_count: number
  created_at: string
}

export interface TripGroupBasic {
  id: number
  name: string
  day_of_week: number
  day_name: string
  description: string | null
}

export interface DriverBasic {
  id: number
  name: string
}

export interface UserBasic {
  id: number
  username: string
}

// Weekly Driver Assignment types
export interface WeeklyDriverAssignment {
  id: number
  trip_group: TripGroupBasic
  driver: DriverBasic
  week_start_date: string
  assigned_at: string
  assigned_by_user: UserBasic | null
  notes: string | null
}

export interface WeeklyAssignmentsResponse {
  week_start_date: string
  assignments: WeeklyDriverAssignment[]
  unassigned_groups: TripGroupBasic[]
  available_drivers: DriverBasic[]
}

export interface AutoAssignmentPreview {
  trip_group: TripGroupBasic
  driver: DriverBasic | null
  reason: string | null
}

export interface AutoAssignResponse {
  week_start_date: string
  assignments_created: number
  groups_unassigned: number
  assignments: WeeklyDriverAssignment[]
  unassigned: AutoAssignmentPreview[]
  message: string
}
