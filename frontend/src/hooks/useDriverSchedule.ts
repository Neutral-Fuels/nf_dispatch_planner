import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { DriverStatus } from '../types/api'

// Query keys
export const driverScheduleKeys = {
  all: ['driver-schedule'] as const,
  monthly: (driverId: number, year: number, month: number) =>
    [...driverScheduleKeys.all, 'monthly', driverId, year, month] as const,
  allDriversMonthly: (year: number, month: number) =>
    [...driverScheduleKeys.all, 'all-drivers', year, month] as const,
  tripSheet: (driverId: number, date: string) =>
    [...driverScheduleKeys.all, 'trip-sheet', driverId, date] as const,
}

// Types
export interface DriverDaySchedule {
  date: string
  status: DriverStatus
  trips_count: number
  total_volume: number
}

export interface DriverMonthlySchedule {
  driver_id: number
  driver_name: string
  year: number
  month: number
  days: DriverDaySchedule[]
  summary: {
    working_days: number
    off_days: number
    holiday_days: number
    float_days: number
    total_trips: number
    total_volume: number
  }
}

export interface AllDriversMonthlySchedule {
  year: number
  month: number
  drivers: DriverMonthlySchedule[]
}

export interface UpdateDriverDayRequest {
  driver_id: number
  date: string
  status: DriverStatus
}

export interface BulkUpdateDriverScheduleRequest {
  driver_id: number
  dates: string[]
  status: DriverStatus
}

export interface TripSheetTrip {
  id: number
  sequence: number
  customer_name: string
  customer_code: string
  customer_address: string | null
  start_time: string
  end_time: string
  tanker_code: string
  tanker_capacity: number
  fuel_blend: string
  volume: number
  status: string
  notes: string | null
}

export interface DriverTripSheet {
  driver_id: number
  driver_name: string
  driver_license: string | null
  driver_phone: string | null
  date: string
  status: DriverStatus
  trips: TripSheetTrip[]
  summary: {
    total_trips: number
    total_volume: number
    completed_trips: number
    remaining_trips: number
  }
}

// Helper to get date range for a month
const getMonthDateRange = (year: number, month: number) => {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // Last day of month
  return {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  }
}

// API functions
const fetchDriverMonthlySchedule = async (
  driverId: number,
  year: number,
  month: number
): Promise<DriverMonthlySchedule> => {
  const { start_date, end_date } = getMonthDateRange(year, month)
  const { data } = await api.get(`/drivers/${driverId}/schedule`, {
    params: { start_date, end_date }
  })

  // Transform backend response to expected format
  return {
    driver_id: driverId,
    driver_name: '',
    year,
    month,
    days: Array.isArray(data) ? data.map((s: { schedule_date: string; status: string; notes?: string }) => ({
      date: s.schedule_date,
      status: s.status as DriverStatus,
      trips_count: 0,
      total_volume: 0,
    })) : [],
    summary: {
      working_days: 0,
      off_days: 0,
      holiday_days: 0,
      float_days: 0,
      total_trips: 0,
      total_volume: 0,
    },
  }
}

const fetchAllDriversMonthlySchedule = async (
  year: number,
  month: number
): Promise<AllDriversMonthlySchedule> => {
  const { start_date, end_date } = getMonthDateRange(year, month)
  const { data } = await api.get('/drivers/schedules/all', {
    params: { start_date, end_date }
  })

  // Transform backend response to expected format
  const drivers: DriverMonthlySchedule[] = Object.entries(data).map(([driverId, driverData]: [string, unknown]) => {
    const typedData = driverData as { driver_name: string; driver_type: string; schedules: Array<{ date: string; status: string; notes?: string }> }
    return {
      driver_id: parseInt(driverId),
      driver_name: typedData.driver_name,
      year,
      month,
      days: typedData.schedules.map((s) => ({
        date: s.date,
        status: s.status as DriverStatus,
        trips_count: 0,
        total_volume: 0,
      })),
      summary: {
        working_days: typedData.schedules.filter((s) => s.status === 'working').length,
        off_days: typedData.schedules.filter((s) => s.status === 'off').length,
        holiday_days: typedData.schedules.filter((s) => s.status === 'holiday').length,
        float_days: typedData.schedules.filter((s) => s.status === 'float').length,
        total_trips: 0,
        total_volume: 0,
      },
    }
  })

  return { year, month, drivers }
}

const updateDriverDayStatus = async (request: UpdateDriverDayRequest): Promise<void> => {
  await api.post(`/drivers/${request.driver_id}/schedule`, {
    date: request.date,
    status: request.status,
  })
}

const bulkUpdateDriverSchedule = async (
  request: BulkUpdateDriverScheduleRequest
): Promise<void> => {
  // Backend expects start_date, end_date, and pattern - adapting the request
  const dates = request.dates.sort()
  if (dates.length === 0) return

  await api.post(`/drivers/${request.driver_id}/schedule/bulk`, {
    start_date: dates[0],
    end_date: dates[dates.length - 1],
    pattern: [request.status, request.status, request.status, request.status, request.status, request.status, request.status],
  })
}

const fetchDriverTripSheet = async (
  driverId: number,
  date: string
): Promise<DriverTripSheet> => {
  const { data } = await api.get(`/drivers/${driverId}/trips`, {
    params: { schedule_date: date }
  })

  // Transform to expected format
  return {
    driver_id: data.driver.id,
    driver_name: data.driver.name,
    driver_license: null,
    driver_phone: null,
    date: data.date,
    status: 'working' as DriverStatus,
    trips: data.trips.map((t: { id: number; customer: { code: string; name: string; address: string | null }; tanker: { name: string; max_capacity?: number } | null; fuel_blend: string | null; start_time: string; end_time: string; volume: number; status?: string; notes?: string | null }, idx: number) => ({
      id: t.id,
      sequence: idx + 1,
      customer_name: t.customer.name,
      customer_code: t.customer.code,
      customer_address: t.customer.address,
      start_time: t.start_time,
      end_time: t.end_time,
      tanker_code: t.tanker?.name || '',
      tanker_capacity: t.tanker?.max_capacity || 0,
      fuel_blend: t.fuel_blend || '',
      volume: t.volume,
      status: t.status || 'scheduled',
      notes: t.notes,
    })),
    summary: {
      total_trips: data.total_trips,
      total_volume: data.total_volume,
      completed_trips: 0,
      remaining_trips: data.total_trips,
    },
  }
}

// Hooks
export function useDriverMonthlySchedule(driverId: number, year: number, month: number) {
  return useQuery({
    queryKey: driverScheduleKeys.monthly(driverId, year, month),
    queryFn: () => fetchDriverMonthlySchedule(driverId, year, month),
    enabled: !!driverId && !!year && !!month,
  })
}

export function useAllDriversMonthlySchedule(year: number, month: number) {
  return useQuery({
    queryKey: driverScheduleKeys.allDriversMonthly(year, month),
    queryFn: () => fetchAllDriversMonthlySchedule(year, month),
    enabled: !!year && !!month,
  })
}

export function useUpdateDriverDayStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateDriverDayStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverScheduleKeys.all })
    },
  })
}

export function useBulkUpdateDriverSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkUpdateDriverSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverScheduleKeys.all })
    },
  })
}

export function useDriverTripSheet(driverId: number, date: string) {
  return useQuery({
    queryKey: driverScheduleKeys.tripSheet(driverId, date),
    queryFn: () => fetchDriverTripSheet(driverId, date),
    enabled: !!driverId && !!date,
  })
}
