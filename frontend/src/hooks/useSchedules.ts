import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { WeeklyTemplate, DailySchedule, Trip, TripStatus } from '../types/api'

// Query keys
export const scheduleKeys = {
  all: ['schedules'] as const,
  templates: () => [...scheduleKeys.all, 'templates'] as const,
  templatesByDay: (dayOfWeek: number) => [...scheduleKeys.templates(), dayOfWeek] as const,
  daily: () => [...scheduleKeys.all, 'daily'] as const,
  dailyByDate: (date: string) => [...scheduleKeys.daily(), date] as const,
  trips: () => [...scheduleKeys.all, 'trips'] as const,
  trip: (id: number) => [...scheduleKeys.trips(), id] as const,
}

// Types
export interface CreateTemplateRequest {
  customer_id: number
  day_of_week: number
  start_time: string
  end_time: string
  tanker_id?: number | null
  fuel_blend_id?: number | null
  volume: number
  is_mobile_op?: boolean
  needs_return?: boolean
  priority?: number
  notes?: string | null
  is_active?: boolean
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface UpdateTripRequest {
  tanker_id?: number | null
  driver_id?: number | null
  start_time?: string
  end_time?: string
  volume?: number
  status?: TripStatus
  notes?: string | null
}

export interface GenerateScheduleRequest {
  date: string
  overwrite?: boolean
}

// API functions
const fetchTemplatesByDay = async (dayOfWeek: number): Promise<WeeklyTemplate[]> => {
  const { data } = await api.get(`/templates/day/${dayOfWeek}`)
  return data
}

const fetchAllTemplates = async (): Promise<WeeklyTemplate[]> => {
  const { data } = await api.get('/templates')
  return data
}

const createTemplate = async (template: CreateTemplateRequest): Promise<WeeklyTemplate> => {
  const { data } = await api.post('/templates', template)
  return data
}

const updateTemplate = async ({ id, ...template }: UpdateTemplateRequest & { id: number }): Promise<WeeklyTemplate> => {
  const { data } = await api.put(`/templates/${id}`, template)
  return data
}

const deleteTemplate = async (id: number): Promise<void> => {
  await api.delete(`/templates/${id}`)
}

const fetchDailySchedule = async (date: string): Promise<DailySchedule> => {
  const { data } = await api.get(`/schedules/${date}`)
  return data
}

const generateSchedule = async (request: GenerateScheduleRequest): Promise<DailySchedule> => {
  const { data } = await api.post('/schedules/generate', request)
  return data
}

const lockSchedule = async (date: string): Promise<DailySchedule> => {
  const { data } = await api.post(`/schedules/${date}/lock`)
  return data
}

const unlockSchedule = async (date: string): Promise<DailySchedule> => {
  const { data } = await api.post(`/schedules/${date}/unlock`)
  return data
}

const updateTrip = async ({ id, ...trip }: UpdateTripRequest & { id: number }): Promise<Trip> => {
  const { data } = await api.put(`/trips/${id}`, trip)
  return data
}

const deleteTrip = async (id: number): Promise<void> => {
  await api.delete(`/trips/${id}`)
}

// Hooks
export function useTemplatesByDay(dayOfWeek: number) {
  return useQuery({
    queryKey: scheduleKeys.templatesByDay(dayOfWeek),
    queryFn: () => fetchTemplatesByDay(dayOfWeek),
  })
}

export function useAllTemplates() {
  return useQuery({
    queryKey: scheduleKeys.templates(),
    queryFn: fetchAllTemplates,
  })
}

export function useCreateTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.templates() })
    },
  })
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.templates() })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.templates() })
    },
  })
}

export function useDailySchedule(date: string) {
  return useQuery({
    queryKey: scheduleKeys.dailyByDate(date),
    queryFn: () => fetchDailySchedule(date),
    enabled: !!date,
  })
}

export function useGenerateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generateSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.daily() })
    },
  })
}

export function useLockSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: lockSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.daily() })
    },
  })
}

export function useUnlockSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unlockSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.daily() })
    },
  })
}

export function useUpdateTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.daily() })
    },
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.daily() })
    },
  })
}
