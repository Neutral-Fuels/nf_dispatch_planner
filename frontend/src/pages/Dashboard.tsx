import { useState } from 'react'
import { format, startOfWeek, subWeeks } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  CalendarDays,
  Truck,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Droplet,
  Lock,
  ArrowRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Loader } from '../components/common/Loader'
import {
  useDashboardSummary,
  useAlerts,
  useTankerUtilization,
  useDriverStatusSummary,
  useWeeklyTrend,
} from '../hooks/useDashboard'
import { formatVolume } from '../utils/formatters'

// Chart colors
const COLORS = {
  primary: '#22c55e',
  success: '#16a34a',
  warning: '#eab308',
  danger: '#dc2626',
  info: '#3b82f6',
  secondary: '#9ca3af',
}

const PIE_COLORS = [COLORS.success, COLORS.secondary, COLORS.info, COLORS.warning]

export function Dashboard() {
  const navigate = useNavigate()
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 6 }), 'yyyy-MM-dd')

  // Fetch data
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(today)
  const { data: alerts, isLoading: alertsLoading } = useAlerts()
  const { data: tankerUtilization, isLoading: utilizationLoading } = useTankerUtilization(today)
  const { data: driverStatus, isLoading: driverStatusLoading } = useDriverStatusSummary(today)
  const { data: weeklyTrend, isLoading: trendLoading } = useWeeklyTrend(weekStart)

  const formattedDate = format(new Date(), 'EEEE, d MMMM yyyy')

  // Calculate stats (with fallback for when API is not available)
  const stats = summary || {
    total_trips: 0,
    assigned_trips: 0,
    unassigned_trips: 0,
    conflict_trips: 0,
    completed_trips: 0,
    total_volume: 0,
    active_tankers: 0,
    active_drivers: 0,
    is_schedule_locked: false,
  }

  const assignedPercentage = stats.total_trips > 0
    ? Math.round((stats.assigned_trips / stats.total_trips) * 100)
    : 0

  // Format driver status for pie chart
  const driverChartData = driverStatus?.map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: item.count,
  })) || [
    { name: 'Working', value: 8 },
    { name: 'Off', value: 3 },
    { name: 'Holiday', value: 1 },
    { name: 'Float', value: 2 },
  ]

  // Format weekly trend for bar chart
  const trendChartData = weeklyTrend?.map((item) => ({
    name: item.day_name.slice(0, 3),
    trips: item.total_trips,
    volume: Math.round(item.total_volume / 1000), // Convert to thousands
  })) || [
    { name: 'Sat', trips: 25, volume: 85 },
    { name: 'Sun', trips: 28, volume: 92 },
    { name: 'Mon', trips: 32, volume: 105 },
    { name: 'Tue', trips: 30, volume: 98 },
    { name: 'Wed', trips: 27, volume: 88 },
    { name: 'Thu', trips: 22, volume: 75 },
    { name: 'Fri', trips: 15, volume: 52 },
  ]

  // Format tanker utilization for bar chart
  const utilizationChartData = tankerUtilization?.slice(0, 6).map((item) => ({
    name: item.tanker_name,
    utilization: item.utilization_percentage,
    trips: item.trips_count,
  })) || [
    { name: 'Tanker 1', utilization: 85, trips: 5 },
    { name: 'Tanker 2', utilization: 72, trips: 4 },
    { name: 'Tanker 3', utilization: 68, trips: 4 },
    { name: 'Tanker 4', utilization: 55, trips: 3 },
    { name: 'Tanker 5', utilization: 45, trips: 2 },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2">
          {stats.is_schedule_locked && (
            <Badge variant="info" className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Schedule Locked
            </Badge>
          )}
          <Button onClick={() => navigate(`/schedule/${today}`)}>
            View Today's Schedule
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <CalendarDays className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Trips</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_trips}</p>
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
              <p className="text-2xl font-bold text-gray-900">{stats.assigned_trips}</p>
              <p className="text-xs text-green-600">{assignedPercentage}%</p>
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
              <p className="text-2xl font-bold text-gray-900">{stats.unassigned_trips}</p>
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
              <p className="text-2xl font-bold text-gray-900">{stats.conflict_trips}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
              <Droplet className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatVolume(stats.total_volume)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Trend</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number, name: string) => [
                    name === 'volume' ? `${value}K L` : value,
                    name === 'volume' ? 'Volume' : 'Trips',
                  ]}
                />
                <Bar dataKey="trips" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="volume" fill={COLORS.info} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Driver Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Driver Status</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={driverChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {driverChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tanker Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Tanker Utilization</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={utilizationChartData}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 60, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`${value}%`, 'Utilization']}
                />
                <Bar dataKey="utilization" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alerts & Notifications
            </CardTitle>
          </CardHeader>
          {alertsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader />
            </div>
          ) : alerts && alerts.length > 0 ? (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg p-3 ${
                    alert.type === 'error'
                      ? 'bg-red-50'
                      : alert.type === 'warning'
                      ? 'bg-yellow-50'
                      : 'bg-blue-50'
                  }`}
                >
                  {alert.type === 'error' ? (
                    <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
                  ) : alert.type === 'warning' ? (
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-blue-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
              <p className="mt-2 text-sm text-gray-500">No alerts at this time</p>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => navigate('/templates')}
          >
            <CalendarDays className="h-4 w-4" />
            Manage Templates
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => navigate('/drivers')}
          >
            <Users className="h-4 w-4" />
            View Drivers
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => navigate('/tankers')}
          >
            <Truck className="h-4 w-4" />
            View Tankers
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => navigate('/driver-schedule')}
          >
            <CalendarDays className="h-4 w-4" />
            Driver Schedule
          </Button>
        </div>
      </Card>
    </div>
  )
}
