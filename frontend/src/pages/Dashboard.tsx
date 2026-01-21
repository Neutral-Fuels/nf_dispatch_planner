import { format } from 'date-fns'
import {
  CalendarDays,
  Truck,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../components/common/Card'
import { Badge } from '../components/common/Badge'

// Placeholder data - will be replaced with API calls
const todaySummary = {
  date: new Date(),
  trips: {
    total: 28,
    scheduled: 24,
    unassigned: 3,
    conflicts: 1,
  },
  drivers: {
    working: 10,
    off: 3,
    float: 2,
  },
  tankers: {
    active: 8,
    maintenance: 1,
    idle: 1,
  },
}

const alerts = [
  { id: 1, type: 'warning', message: '3 trips have no tanker assigned' },
  { id: 2, type: 'error', message: 'TANKER 2 has overlapping trips at 10:00' },
]

export function Dashboard() {
  const today = format(new Date(), 'EEEE, d MMMM yyyy')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">{today}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <CalendarDays className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Trips</p>
              <p className="text-2xl font-bold text-gray-900">
                {todaySummary.trips.total}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned</p>
              <p className="text-2xl font-bold text-gray-900">
                {todaySummary.trips.scheduled}
              </p>
              <p className="text-xs text-green-600">
                {Math.round((todaySummary.trips.scheduled / todaySummary.trips.total) * 100)}%
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Unassigned</p>
              <p className="text-2xl font-bold text-gray-900">
                {todaySummary.trips.unassigned}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Conflicts</p>
              <p className="text-2xl font-bold text-gray-900">
                {todaySummary.trips.conflicts}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Two column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Driver Status */}
        <Card>
          <CardHeader>
            <CardTitle>Driver Status</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">Working</span>
              </div>
              <span className="font-medium">{todaySummary.drivers.working}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-400" />
                <span className="text-sm text-gray-600">Off</span>
              </div>
              <span className="font-medium">{todaySummary.drivers.off}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="text-sm text-gray-600">Float</span>
              </div>
              <span className="font-medium">{todaySummary.drivers.float}</span>
            </div>
          </div>
        </Card>

        {/* Tanker Status */}
        <Card>
          <CardHeader>
            <CardTitle>Tanker Status</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-600">Active</span>
              </div>
              <span className="font-medium">{todaySummary.tankers.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-gray-600">Maintenance</span>
              </div>
              <span className="font-medium">{todaySummary.tankers.maintenance}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Idle</span>
              </div>
              <span className="font-medium">{todaySummary.tankers.idle}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Alerts
          </CardTitle>
        </CardHeader>
        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
              >
                {alert.type === 'warning' ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-sm text-gray-700">{alert.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No alerts at this time.</p>
        )}
      </Card>
    </div>
  )
}
