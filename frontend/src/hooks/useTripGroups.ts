import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { TripGroup, TripGroupListItem, PaginatedResponse } from '../types/api'

// Query keys
export const tripGroupKeys = {
  all: ['trip-groups'] as const,
  lists: () => [...tripGroupKeys.all, 'list'] as const,
  list: (params: TripGroupQueryParams) => [...tripGroupKeys.lists(), params] as const,
  details: () => [...tripGroupKeys.all, 'detail'] as const,
  detail: (id: number) => [...tripGroupKeys.details(), id] as const,
}

// Types
export interface TripGroupQueryParams {
  page?: number
  per_page?: number
  search?: string
  is_active?: boolean
}

export interface CreateTripGroupRequest {
  name: string
  description?: string | null
  template_ids?: number[]
}

export interface UpdateTripGroupRequest extends Partial<CreateTripGroupRequest> {
  is_active?: boolean
}

export interface AddTemplatesRequest {
  template_ids: number[]
}

// API functions
const fetchTripGroups = async (params: TripGroupQueryParams): Promise<PaginatedResponse<TripGroupListItem>> => {
  const { data } = await api.get('/trip-groups', { params })
  return data
}

const fetchTripGroup = async (id: number): Promise<TripGroup> => {
  const { data } = await api.get(`/trip-groups/${id}`)
  return data
}

const createTripGroup = async (group: CreateTripGroupRequest): Promise<TripGroup> => {
  const { data } = await api.post('/trip-groups', group)
  return data
}

const updateTripGroup = async ({ id, ...group }: UpdateTripGroupRequest & { id: number }): Promise<TripGroup> => {
  const { data } = await api.put(`/trip-groups/${id}`, group)
  return data
}

const deleteTripGroup = async (id: number): Promise<void> => {
  await api.delete(`/trip-groups/${id}`)
}

const addTemplatesToGroup = async ({ id, template_ids }: { id: number; template_ids: number[] }): Promise<TripGroup> => {
  const { data } = await api.post(`/trip-groups/${id}/templates`, { template_ids })
  return data
}

const removeTemplateFromGroup = async ({ groupId, templateId }: { groupId: number; templateId: number }): Promise<TripGroup> => {
  const { data } = await api.delete(`/trip-groups/${groupId}/templates/${templateId}`)
  return data
}

const removeTemplatesFromGroup = async ({ id, template_ids }: { id: number; template_ids: number[] }): Promise<TripGroup> => {
  const { data } = await api.post(`/trip-groups/${id}/templates/remove`, { template_ids })
  return data
}

// Hooks
export function useTripGroups(params: TripGroupQueryParams = {}) {
  return useQuery({
    queryKey: tripGroupKeys.list(params),
    queryFn: () => fetchTripGroups(params),
  })
}

export function useTripGroup(id: number) {
  return useQuery({
    queryKey: tripGroupKeys.detail(id),
    queryFn: () => fetchTripGroup(id),
    enabled: !!id,
  })
}

export function useCreateTripGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTripGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripGroupKeys.lists() })
    },
  })
}

export function useUpdateTripGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTripGroup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tripGroupKeys.lists() })
      queryClient.setQueryData(tripGroupKeys.detail(data.id), data)
    },
  })
}

export function useDeleteTripGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTripGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripGroupKeys.lists() })
    },
  })
}

export function useAddTemplatesToGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addTemplatesToGroup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tripGroupKeys.lists() })
      queryClient.setQueryData(tripGroupKeys.detail(data.id), data)
    },
  })
}

export function useRemoveTemplateFromGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: removeTemplateFromGroup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tripGroupKeys.lists() })
      queryClient.setQueryData(tripGroupKeys.detail(data.id), data)
    },
  })
}

export function useRemoveTemplatesFromGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: removeTemplatesFromGroup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tripGroupKeys.lists() })
      queryClient.setQueryData(tripGroupKeys.detail(data.id), data)
    },
  })
}
