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
  const { data } = await api.get('/dashboard/summary', { params: { summary_date: date } })
  // Transform backend response to expected format
  return {
    date: data.date,
    total_trips: data.trips?.total ?? 0,
    assigned_trips: data.trips?.assigned ?? 0,
    unassigned_trips: data.trips?.unassigned ?? 0,
    conflict_trips: data.trips?.conflicts ?? 0,
    completed_trips: data.trips?.completed ?? 0,
    total_volume: data.volume?.total_scheduled ?? 0,
    active_tankers: data.resources?.active_tankers ?? 0,
    active_drivers: data.resources?.active_drivers ?? 0,
    is_schedule_locked: data.schedule_locked ?? false,
  }
}

const fetchAlerts = async (): Promise<Alert[]> => {
  const { data } = await api.get('/dashboard/alerts')
  return data.alerts || data
}

const fetchTankerUtilization = async (date: string): Promise<TankerUtilization[]> => {
  const { data } = await api.get('/dashboard/tanker-utilization', { params: { summary_date: date } })
  const tankers = data.tankers || data
  // Transform backend field names to frontend expected format
  return tankers.map((t: { tanker_id: number; tanker_name: string; max_capacity: number; trip_count: number; volume_scheduled: number; utilization_percent: number }) => ({
    tanker_id: t.tanker_id,
    tanker_name: t.tanker_name,
    max_capacity: t.max_capacity,
    trips_count: t.trip_count,
    total_volume: t.volume_scheduled,
    utilization_percentage: t.utilization_percent,
  }))
}

const fetchDriverStatus = async (date: string): Promise<DriverStatusSummary[]> => {
  const { data } = await api.get('/dashboard/driver-status', { params: { summary_date: date } })
  // Transform backend response { summary: { working: 5, off: 2, ... }, drivers: [...] }
  // to array format [{ status: 'working', count: 5, percentage: 25 }, ...]
  if (data.summary) {
    const summary = data.summary as Record<string, number>
    const total = Object.values(summary).reduce((sum: number, count: number) => sum + count, 0)
    return Object.entries(summary)
      .filter(([status]) => status !== 'unset')
      .map(([status, count]) => ({
        status,
        count: count as number,
        percentage: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
      }))
  }
  return data
}

const fetchWeeklyTrend = async (startDate: string): Promise<DailyTrend[]> => {
  const { data } = await api.get('/dashboard/weekly-overview', { params: { start_date: startDate } })
  return data.days || data
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
