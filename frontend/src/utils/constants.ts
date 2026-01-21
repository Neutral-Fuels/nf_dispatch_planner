// Day names for UAE week (Saturday to Friday)
export const DAY_NAMES = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const

// Day short names
export const DAY_SHORT_NAMES = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

// Status colors
export const STATUS_COLORS = {
  scheduled: 'bg-green-100 text-green-800',
  unassigned: 'bg-yellow-100 text-yellow-800',
  conflict: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-800',
} as const

// Driver status colors
export const DRIVER_STATUS_COLORS = {
  working: 'bg-green-500',
  off: 'bg-gray-400',
  holiday: 'bg-blue-400',
  float: 'bg-yellow-400',
} as const

// Tanker status colors
export const TANKER_STATUS_COLORS = {
  active: 'badge-success',
  maintenance: 'badge-warning',
  inactive: 'badge-gray',
} as const

// Delivery type labels
export const DELIVERY_TYPE_LABELS = {
  bulk: 'Bulk',
  mobile: 'Mobile',
  both: 'Both',
} as const

// Customer type labels
export const CUSTOMER_TYPE_LABELS = {
  bulk: 'Bulk (Tank)',
  mobile: 'Mobile',
} as const

// User role labels
export const USER_ROLE_LABELS = {
  admin: 'Administrator',
  dispatcher: 'Dispatcher',
  viewer: 'Viewer',
} as const
