import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Customer, PaginatedResponse, CustomerType } from '../types/api'

// Query keys
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: CustomerQueryParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: number) => [...customerKeys.details(), id] as const,
}

// Types
export interface CustomerQueryParams {
  page?: number
  per_page?: number
  search?: string
  customer_type?: CustomerType
  emirate_id?: number
  fuel_blend_id?: number
  is_active?: boolean
}

export interface CreateCustomerRequest {
  name: string
  code: string
  customer_type: CustomerType
  fuel_blend_id?: number | null
  estimated_volume?: number | null
  emirate_id?: number | null
  address?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  notes?: string | null
  is_active?: boolean
}

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {}

// API functions
const fetchCustomers = async (params: CustomerQueryParams): Promise<PaginatedResponse<Customer>> => {
  const { data } = await api.get('/customers', { params })
  return data
}

const fetchCustomer = async (id: number): Promise<Customer> => {
  const { data } = await api.get(`/customers/${id}`)
  return data
}

const createCustomer = async (customer: CreateCustomerRequest): Promise<Customer> => {
  const { data } = await api.post('/customers', customer)
  return data
}

const updateCustomer = async ({ id, ...customer }: UpdateCustomerRequest & { id: number }): Promise<Customer> => {
  const { data } = await api.put(`/customers/${id}`, customer)
  return data
}

const deleteCustomer = async (id: number): Promise<void> => {
  await api.delete(`/customers/${id}`)
}

// Hooks
export function useCustomers(params: CustomerQueryParams = {}) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => fetchCustomers(params),
  })
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => fetchCustomer(id),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateCustomer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.setQueryData(customerKeys.detail(data.id), data)
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}
