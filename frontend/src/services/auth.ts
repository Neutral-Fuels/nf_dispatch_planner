import api from './api'
import { useAuthStore, User } from '../store/authStore'

interface LoginRequest {
  username: string
  password: string
}

interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', credentials)
    const { access_token, user } = response.data

    // Store auth state
    useAuthStore.getState().setAuth(user, access_token)

    return response.data
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me')
    return response.data
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.post('/auth/change-password', data)
  },

  logout(): void {
    useAuthStore.getState().logout()
  },
}
