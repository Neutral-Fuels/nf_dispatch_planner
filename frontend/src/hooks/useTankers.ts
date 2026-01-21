import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Tanker, PaginatedResponse, DeliveryType, TankerStatus } from '../types/api'

// Query keys
export const tankerKeys = {
  all: ['tankers'] as const,
  lists: () => [...tankerKeys.all, 'list'] as const,
  list: (params: TankerQueryParams) => [...tankerKeys.lists(), params] as const,
  details: () => [...tankerKeys.all, 'detail'] as const,
  detail: (id: number) => [...tankerKeys.details(), id] as const,
  compatible: (tripId: number) => [...tankerKeys.all, 'compatible', tripId] as const,
}

// Types
export interface TankerQueryParams {
  page?: number
  per_page?: number
  search?: string
  delivery_type?: DeliveryType
  status?: TankerStatus
  is_3pl?: boolean
  emirate_id?: number
  fuel_blend_id?: number
  is_active?: boolean
}

export interface CreateTankerRequest {
  name: string
  registration?: string | null
  max_capacity: number
  delivery_type: DeliveryType
  status?: TankerStatus
  is_3pl?: boolean
  fuel_blend_ids?: number[]
  emirate_ids?: number[]
  default_driver_id?: number | null
  notes?: string | null
  is_active?: boolean
}

export interface UpdateTankerRequest extends Partial<CreateTankerRequest> {}

// API functions
const fetchTankers = async (params: TankerQueryParams): Promise<PaginatedResponse<Tanker>> => {
  const { data } = await api.get('/tankers', { params })
  return data
}

const fetchTanker = async (id: number): Promise<Tanker> => {
  const { data } = await api.get(`/tankers/${id}`)
  return data
}

const fetchCompatibleTankers = async (tripId: number): Promise<Tanker[]> => {
  const { data } = await api.get(`/schedules/trips/${tripId}/compatible-tankers`)
  return data
}

const createTanker = async (tanker: CreateTankerRequest): Promise<Tanker> => {
  const { data } = await api.post('/tankers', tanker)
  return data
}

const updateTanker = async ({ id, ...tanker }: UpdateTankerRequest & { id: number }): Promise<Tanker> => {
  const { data } = await api.put(`/tankers/${id}`, tanker)
  return data
}

const deleteTanker = async (id: number): Promise<void> => {
  await api.delete(`/tankers/${id}`)
}

// Hooks
export function useTankers(params: TankerQueryParams = {}) {
  return useQuery({
    queryKey: tankerKeys.list(params),
    queryFn: () => fetchTankers(params),
  })
}

export function useTanker(id: number) {
  return useQuery({
    queryKey: tankerKeys.detail(id),
    queryFn: () => fetchTanker(id),
    enabled: !!id,
  })
}

export function useCompatibleTankers(tripId: number) {
  return useQuery({
    queryKey: tankerKeys.compatible(tripId),
    queryFn: () => fetchCompatibleTankers(tripId),
    enabled: !!tripId,
  })
}

export function useCreateTanker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTanker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tankerKeys.lists() })
    },
  })
}

export function useUpdateTanker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTanker,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tankerKeys.lists() })
      queryClient.setQueryData(tankerKeys.detail(data.id), data)
    },
  })
}

export function useDeleteTanker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTanker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tankerKeys.lists() })
    },
  })
}
