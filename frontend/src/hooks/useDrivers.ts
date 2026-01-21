import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Driver, PaginatedResponse, DriverType } from '../types/api'

// Query keys
export const driverKeys = {
  all: ['drivers'] as const,
  lists: () => [...driverKeys.all, 'list'] as const,
  list: (params: DriverQueryParams) => [...driverKeys.lists(), params] as const,
  details: () => [...driverKeys.all, 'detail'] as const,
  detail: (id: number) => [...driverKeys.details(), id] as const,
}

// Types
export interface DriverQueryParams {
  page?: number
  per_page?: number
  search?: string
  driver_type?: DriverType
  is_active?: boolean
}

export interface CreateDriverRequest {
  name: string
  employee_id?: string | null
  driver_type: DriverType
  contact_phone?: string | null
  license_number?: string | null
  license_expiry?: string | null
  notes?: string | null
  is_active?: boolean
}

export interface UpdateDriverRequest extends Partial<CreateDriverRequest> {}

// API functions
const fetchDrivers = async (params: DriverQueryParams): Promise<PaginatedResponse<Driver>> => {
  const { data } = await api.get('/drivers', { params })
  return data
}

const fetchDriver = async (id: number): Promise<Driver> => {
  const { data } = await api.get(`/drivers/${id}`)
  return data
}

const createDriver = async (driver: CreateDriverRequest): Promise<Driver> => {
  const { data } = await api.post('/drivers', driver)
  return data
}

const updateDriver = async ({ id, ...driver }: UpdateDriverRequest & { id: number }): Promise<Driver> => {
  const { data } = await api.put(`/drivers/${id}`, driver)
  return data
}

const deleteDriver = async (id: number): Promise<void> => {
  await api.delete(`/drivers/${id}`)
}

// Hooks
export function useDrivers(params: DriverQueryParams = {}) {
  return useQuery({
    queryKey: driverKeys.list(params),
    queryFn: () => fetchDrivers(params),
  })
}

export function useDriver(id: number) {
  return useQuery({
    queryKey: driverKeys.detail(id),
    queryFn: () => fetchDriver(id),
    enabled: !!id,
  })
}

export function useCreateDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.lists() })
    },
  })
}

export function useUpdateDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateDriver,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: driverKeys.lists() })
      queryClient.setQueryData(driverKeys.detail(data.id), data)
    },
  })
}

export function useDeleteDriver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.lists() })
    },
  })
}
