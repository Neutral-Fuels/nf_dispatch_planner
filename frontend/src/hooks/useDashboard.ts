import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (date: string) => [...dashboardKeys.all, 'summary', date] as const,
  alerts: () => [...dashboardKeys.all, 'alerts'] as const,
  tankerUtilization: (date: string) => [...dashboardKeys.all, 'tanker-utilization', date] as const,
  driverStatus: (date: string) => [...dashboardKeys.all, 'driver-status', date] as const,
  weeklyTrend: (startDate: string) => [...dashboardKeys.all, 'weekly-trend', startDate] as const,
}

// Types
export interface DashboardSummary {
  date: string
  total_trips: number
  assigned_trips: number
  unassigned_trips: number
  conflict_trips: number
  completed_trips: number
  total_volume: number
  active_tankers: number
  active_drivers: number
  is_schedule_locked: boolean
}

export interface Alert {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  related_entity?: {
    type: 'trip' | 'driver' | 'tanker' | 'customer'
    id: number
    name: string
  }
  created_at: string
}

export interface TankerUtilization {
  tanker_id: number
  tanker_name: string
  max_capacity: number
  trips_count: number
  total_volume: number
  utilization_percentage: number
}

export interface DriverStatusSummary {
  status: string
  count: number
  percentage: number
}

export interface DailyTrend {
  date: string
  day_name: string
  total_trips: number
  total_volume: number
  assigned_percentage: number
}

// API functions
const fetchDashboardSummary = async (date: string): Promise<DashboardSummary> => {
  const { data } = await api.get(`/dashboard/summary/${date}`)
  return data
}

const fetchAlerts = async (): Promise<Alert[]> => {
  const { data } = await api.get('/dashboard/alerts')
  return data
}

const fetchTankerUtilization = async (date: string): Promise<TankerUtilization[]> => {
  const { data } = await api.get(`/dashboard/tanker-utilization/${date}`)
  return data
}

const fetchDriverStatus = async (date: string): Promise<DriverStatusSummary[]> => {
  const { data } = await api.get(`/dashboard/driver-status/${date}`)
  return data
}

const fetchWeeklyTrend = async (startDate: string): Promise<DailyTrend[]> => {
  const { data } = await api.get(`/dashboard/weekly-trend/${startDate}`)
  return data
}

// Hooks
export function useDashboardSummary(date: string) {
  return useQuery({
    queryKey: dashboardKeys.summary(date),
    queryFn: () => fetchDashboardSummary(date),
    enabled: !!date,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

export function useAlerts() {
  return useQuery({
    queryKey: dashboardKeys.alerts(),
    queryFn: fetchAlerts,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  })
}

export function useTankerUtilization(date: string) {
  return useQuery({
    queryKey: dashboardKeys.tankerUtilization(date),
    queryFn: () => fetchTankerUtilization(date),
    enabled: !!date,
    staleTime: 1000 * 60 * 2,
  })
}

export function useDriverStatusSummary(date: string) {
  return useQuery({
    queryKey: dashboardKeys.driverStatus(date),
    queryFn: () => fetchDriverStatus(date),
    enabled: !!date,
    staleTime: 1000 * 60 * 2,
  })
}

export function useWeeklyTrend(startDate: string) {
  return useQuery({
    queryKey: dashboardKeys.weeklyTrend(startDate),
    queryFn: () => fetchWeeklyTrend(startDate),
    enabled: !!startDate,
    staleTime: 1000 * 60 * 5,
  })
}
