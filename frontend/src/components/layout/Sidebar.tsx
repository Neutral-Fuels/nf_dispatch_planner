import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Users,
  Truck,
  Building2,
  Settings,
  UserCog,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { useAuthStore } from '../../store/authStore'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Daily Schedule', href: '/schedule', icon: Calendar },
  { name: 'Weekly Templates', href: '/templates', icon: CalendarClock },
  { name: 'Driver Schedule', href: '/driver-schedule', icon: CalendarDays },
  { name: 'Trip Sheet', href: '/driver-trip-sheet', icon: ClipboardList },
  { name: 'Drivers', href: '/drivers', icon: Users },
  { name: 'Tankers', href: '/tankers', icon: Truck },
  { name: 'Customers', href: '/customers', icon: Building2 },
]

const adminNavigation = [
  { name: 'Users', href: '/users', icon: UserCog },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white lg:block">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
          NF
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">NF Dispatch</div>
          <div className="text-xs text-gray-500">Planner</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-4">
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Main
        </div>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Administration
            </div>
            {adminNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}
