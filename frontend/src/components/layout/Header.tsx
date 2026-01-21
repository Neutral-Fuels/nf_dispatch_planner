import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/auth'

export function Header() {
  const [showDropdown, setShowDropdown] = useState(false)
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Left side - could add breadcrumbs or search here */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button would go here */}
      </div>

      {/* Right side - user menu */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden md:block">{user?.full_name || user?.username}</span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <p className="mt-1 text-xs capitalize text-primary-600">
                  {user?.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
