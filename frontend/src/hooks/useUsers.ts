import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { PaginatedResponse, User, UserRole } from '../types/api'

// Query keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
}

// Types
export interface UserListParams {
  search?: string
  role?: UserRole
  is_active?: boolean
  page?: number
  per_page?: number
}

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  full_name?: string | null
  role: UserRole
  is_active?: boolean
}

export interface UpdateUserRequest {
  username?: string
  email?: string
  full_name?: string | null
  role?: UserRole
  is_active?: boolean
}

export interface ChangePasswordRequest {
  new_password: string
}

// API functions
const fetchUsers = async (params: UserListParams): Promise<PaginatedResponse<User>> => {
  const { data } = await api.get('/users', { params })
  return data
}

const fetchUser = async (id: number): Promise<User> => {
  const { data } = await api.get(`/users/${id}`)
  return data
}

const createUser = async (user: CreateUserRequest): Promise<User> => {
  const { data } = await api.post('/users', user)
  return data
}

const updateUser = async ({ id, ...user }: UpdateUserRequest & { id: number }): Promise<User> => {
  const { data } = await api.put(`/users/${id}`, user)
  return data
}

const deleteUser = async (id: number): Promise<void> => {
  await api.delete(`/users/${id}`)
}

const changeUserPassword = async ({ id, new_password }: { id: number; new_password: string }): Promise<void> => {
  await api.put(`/users/${id}/password`, { new_password })
}

// Hooks
export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => fetchUsers(params),
  })
}

export function useUser(id: number) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => fetchUser(id),
    enabled: !!id,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.setQueryData(userKeys.detail(data.id), data)
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

export function useChangeUserPassword() {
  return useMutation({
    mutationFn: changeUserPassword,
  })
}
