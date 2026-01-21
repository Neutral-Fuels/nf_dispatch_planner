import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import {
  WeeklyDriverAssignment,
  WeeklyAssignmentsResponse,
  AutoAssignResponse,
} from '../types/api'
import { tripGroupKeys } from './useTripGroups'

// Query keys
export const assignmentKeys = {
  all: ['assignments'] as const,
  weeks: () => [...assignmentKeys.all, 'week'] as const,
  week: (weekStart: string) => [...assignmentKeys.weeks(), weekStart] as const,
}

// Types
export interface CreateAssignmentRequest {
  trip_group_id: number
  driver_id: number
  week_start_date: string
  notes?: string | null
}

export interface UpdateAssignmentRequest {
  driver_id?: number
  notes?: string | null
}

export interface AutoAssignRequest {
  week_start_date: string
  min_rest_hours?: number
  dry_run?: boolean
}

// API functions
const fetchWeeklyAssignments = async (weekStart: string): Promise<WeeklyAssignmentsResponse> => {
  const { data } = await api.get('/assignments', { params: { week_start: weekStart } })
  return data
}

const createAssignment = async (assignment: CreateAssignmentRequest): Promise<WeeklyDriverAssignment> => {
  const { data } = await api.post('/assignments', assignment)
  return data
}

const updateAssignment = async ({
  id,
  ...assignment
}: UpdateAssignmentRequest & { id: number }): Promise<WeeklyDriverAssignment> => {
  const { data } = await api.put(`/assignments/${id}`, assignment)
  return data
}

const deleteAssignment = async (id: number): Promise<void> => {
  await api.delete(`/assignments/${id}`)
}

const autoAssignDrivers = async (request: AutoAssignRequest): Promise<AutoAssignResponse> => {
  const { data } = await api.post('/assignments/auto-assign', request)
  return data
}

const clearWeekAssignments = async (weekStart: string): Promise<void> => {
  await api.delete(`/assignments/week/${weekStart}`)
}

// Hooks
export function useWeeklyAssignments(weekStart: string) {
  return useQuery({
    queryKey: assignmentKeys.week(weekStart),
    queryFn: () => fetchWeeklyAssignments(weekStart),
    enabled: !!weekStart,
  })
}

export function useCreateAssignment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAssignment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.week(data.week_start_date) })
    },
  })
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAssignment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.week(data.week_start_date) })
    },
  })
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.weeks() })
    },
  })
}

export function useAutoAssign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: autoAssignDrivers,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.week(data.week_start_date) })
      // Also invalidate trip groups in case template counts changed
      queryClient.invalidateQueries({ queryKey: tripGroupKeys.lists() })
    },
  })
}

export function useClearWeekAssignments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearWeekAssignments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.weeks() })
    },
  })
}
