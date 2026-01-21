import { DriverScheduleGrid } from '../components/schedule/DriverScheduleGrid'

export function DriverSchedule() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Driver Schedule</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage driver availability and view monthly schedules
        </p>
      </div>

      {/* Schedule Grid */}
      <DriverScheduleGrid />
    </div>
  )
}
