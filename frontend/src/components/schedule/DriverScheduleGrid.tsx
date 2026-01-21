import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, User } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { Select } from '../common/Select'
import { Modal, ModalFooter } from '../common/Modal'
import { useDrivers } from '../../hooks/useDrivers'
import {
  useAllDriversMonthlySchedule,
  useUpdateDriverDayStatus,
  useBulkUpdateDriverSchedule,
  DriverDaySchedule,
} from '../../hooks/useDriverSchedule'
import { toast } from '../../store/toastStore'
import { DriverStatus } from '../../types/api'
import { useAuth } from '../../hooks/useAuth'

// Status colors and labels
const STATUS_CONFIG: Record<DriverStatus, { label: string; bgColor: string; textColor: string }> = {
  working: { label: 'W', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  off: { label: 'O', bgColor: 'bg-gray-100', textColor: 'text-gray-600' },
  holiday: { label: 'H', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  float: { label: 'F', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
}

// Day names (UAE week: Saturday to Friday)
const DAY_NAMES = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

interface DriverScheduleGridProps {
  className?: string
}

export function DriverScheduleGrid({ className }: DriverScheduleGridProps) {
  const { canEdit } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedCell, setSelectedCell] = useState<{
    driverId: number
    driverName: string
    date: string
    currentStatus: DriverStatus
  } | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null)
  const [bulkStatus, setBulkStatus] = useState<DriverStatus>('working')
  const [bulkDates, setBulkDates] = useState<string[]>([])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // Fetch data
  const { data: scheduleData, isLoading } = useAllDriversMonthlySchedule(year, month)
  const { data: driversData } = useDrivers({ is_active: true, per_page: 100 })
  const updateStatusMutation = useUpdateDriverDayStatus()
  const bulkUpdateMutation = useBulkUpdateDriverSchedule()

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  // Navigation
  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToCurrentMonth = () => setCurrentDate(new Date())

  // Handle cell click
  const handleCellClick = (
    driverId: number,
    driverName: string,
    date: string,
    currentStatus: DriverStatus
  ) => {
    if (!canEdit) return
    setSelectedCell({ driverId, driverName, date, currentStatus })
  }

  // Handle status change
  const handleStatusChange = async (newStatus: DriverStatus) => {
    if (!selectedCell) return
    try {
      await updateStatusMutation.mutateAsync({
        driver_id: selectedCell.driverId,
        date: selectedCell.date,
        status: newStatus,
      })
      toast.success('Status updated')
      setSelectedCell(null)
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  // Handle bulk update
  const handleBulkUpdate = async () => {
    if (!selectedDriver || bulkDates.length === 0) return
    try {
      await bulkUpdateMutation.mutateAsync({
        driver_id: selectedDriver,
        dates: bulkDates,
        status: bulkStatus,
      })
      toast.success(`Updated ${bulkDates.length} days`)
      setBulkModalOpen(false)
      setBulkDates([])
    } catch (error) {
      toast.error('Failed to update schedule')
    }
  }

  // Get day schedule for a driver
  const getDaySchedule = (
    driverId: number,
    date: string
  ): DriverDaySchedule | null => {
    const driverSchedule = scheduleData?.drivers.find((d) => d.driver_id === driverId)
    return driverSchedule?.days.find((d) => d.date === date) || null
  }

  // Driver options for bulk update
  const driverOptions = useMemo(() => {
    return [
      { value: 0, label: 'Select driver...' },
      ...(driversData?.items || []).map((d) => ({
        value: d.id,
        label: d.name,
      })),
    ]
  }, [driversData])

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Driver Schedule</h2>
          <p className="text-sm text-gray-500">Monthly availability overview</p>
        </div>
        {canEdit && (
          <Button variant="secondary" onClick={() => setBulkModalOpen(true)}>
            Bulk Update
          </Button>
        )}
      </div>

      {/* Month navigation */}
      <Card className="mb-6">
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-semibold text-gray-900">
            {format(currentDate, 'MMMM yyyy')}
          </div>
          <Button variant="ghost" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToCurrentMonth}>
            Today
          </Button>
        </div>
      </Card>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}
            >
              {config.label}
            </div>
            <span className="text-sm text-gray-600 capitalize">{status}</span>
          </div>
        ))}
      </div>

      {/* Schedule Grid */}
      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : !scheduleData || scheduleData.drivers.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No driver schedules found for this month.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Driver
                  </th>
                  {calendarDays.map((day) => {
                    const dayOfWeek = getDay(day)
                    // Adjust for UAE week (Saturday = 0)
                    const uaeDayIndex = dayOfWeek === 6 ? 0 : dayOfWeek + 1
                    const isWeekend = uaeDayIndex === 5 || uaeDayIndex === 6 // Thu & Fri

                    return (
                      <th
                        key={day.toISOString()}
                        className={`px-1 py-2 text-center text-xs ${
                          isWeekend ? 'bg-gray-100' : ''
                        }`}
                      >
                        <div className="text-gray-500">{DAY_NAMES[uaeDayIndex]}</div>
                        <div className="font-medium text-gray-900">
                          {format(day, 'd')}
                        </div>
                      </th>
                    )
                  })}
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {scheduleData.drivers.map((driver) => (
                  <tr key={driver.driver_id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-gray-900">
                          {driver.driver_name}
                        </span>
                      </div>
                    </td>
                    {calendarDays.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const daySchedule = getDaySchedule(driver.driver_id, dateStr)
                      const status = daySchedule?.status || 'off'
                      const config = STATUS_CONFIG[status]
                      const dayOfWeek = getDay(day)
                      const uaeDayIndex = dayOfWeek === 6 ? 0 : dayOfWeek + 1
                      const isWeekend = uaeDayIndex === 5 || uaeDayIndex === 6

                      return (
                        <td
                          key={day.toISOString()}
                          className={`px-1 py-1 text-center ${isWeekend ? 'bg-gray-50' : ''}`}
                        >
                          <button
                            onClick={() =>
                              handleCellClick(
                                driver.driver_id,
                                driver.driver_name,
                                dateStr,
                                status
                              )
                            }
                            className={`mx-auto flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-transform hover:scale-110 ${
                              config.bgColor
                            } ${config.textColor} ${
                              canEdit ? 'cursor-pointer' : 'cursor-default'
                            }`}
                            title={`${driver.driver_name} - ${dateStr}: ${status}`}
                          >
                            {config.label}
                          </button>
                        </td>
                      )
                    })}
                    <td className="whitespace-nowrap px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <Badge variant="success" className="text-xs">
                          {driver.summary.working_days}W
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {driver.summary.off_days}O
                        </Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Status Change Modal */}
      {selectedCell && (
        <Modal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          title="Update Status"
          size="sm"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="font-semibold text-gray-900">{selectedCell.driverName}</div>
              <div className="text-sm text-gray-600">
                {format(new Date(selectedCell.date), 'EEEE, d MMMM yyyy')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status as DriverStatus)}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                    selectedCell.currentStatus === status
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={updateStatusMutation.isPending}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded text-sm font-medium ${config.bgColor} ${config.textColor}`}
                  >
                    {config.label}
                  </div>
                  <span className="text-sm font-medium capitalize">{status}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Update Modal */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Bulk Update Schedule"
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Select Driver"
            options={driverOptions}
            value={selectedDriver || 0}
            onChange={(e) => setSelectedDriver(Number(e.target.value))}
          />

          <Select
            label="Status"
            options={[
              { value: 'working', label: 'Working' },
              { value: 'off', label: 'Off' },
              { value: 'holiday', label: 'Holiday' },
              { value: 'float', label: 'Float' },
            ]}
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as DriverStatus)}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Select Days (click to toggle)
            </label>
            <div className="grid grid-cols-7 gap-1 rounded-lg border p-2">
              {calendarDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const isSelected = bulkDates.includes(dateStr)
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      if (isSelected) {
                        setBulkDates(bulkDates.filter((d) => d !== dateStr))
                      } else {
                        setBulkDates([...bulkDates, dateStr])
                      }
                    }}
                    className={`rounded p-2 text-center text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {bulkDates.length} days selected
            </p>
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setBulkModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkUpdate}
            disabled={!selectedDriver || bulkDates.length === 0}
            isLoading={bulkUpdateMutation.isPending}
          >
            Update {bulkDates.length} Days
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
