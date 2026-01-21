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

// API functions
const fetchDriverMonthlySchedule = async (
  driverId: number,
  year: number,
  month: number
): Promise<DriverMonthlySchedule> => {
  const { data } = await api.get(`/drivers/${driverId}/schedule/${year}/${month}`)
  return data
}

const fetchAllDriversMonthlySchedule = async (
  year: number,
  month: number
): Promise<AllDriversMonthlySchedule> => {
  const { data } = await api.get(`/drivers/schedule/${year}/${month}`)
  return data
}

const updateDriverDayStatus = async (request: UpdateDriverDayRequest): Promise<void> => {
  await api.put(`/drivers/${request.driver_id}/schedule/${request.date}`, {
    status: request.status,
  })
}

const bulkUpdateDriverSchedule = async (
  request: BulkUpdateDriverScheduleRequest
): Promise<void> => {
  await api.post(`/drivers/${request.driver_id}/schedule/bulk`, {
    dates: request.dates,
    status: request.status,
  })
}

const fetchDriverTripSheet = async (
  driverId: number,
  date: string
): Promise<DriverTripSheet> => {
  const { data } = await api.get(`/drivers/${driverId}/trip-sheet/${date}`)
  return data
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
