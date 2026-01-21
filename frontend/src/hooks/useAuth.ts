import { useAuthStore } from '../store/authStore'

/**
 * Hook for accessing auth state and actions
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const logout = useAuthStore((state) => state.logout)

  const isAdmin = user?.role === 'admin'
  const isDispatcher = user?.role === 'dispatcher'
  const isViewer = user?.role === 'viewer'
  const canEdit = isAdmin || isDispatcher

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    isDispatcher,
    isViewer,
    canEdit,
    logout,
  }
}
