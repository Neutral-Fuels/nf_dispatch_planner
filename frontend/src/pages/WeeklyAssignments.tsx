import { useState, useMemo } from 'react'
import { format, addWeeks, subWeeks } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Wand2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Users,
  Layers,
  Calendar,
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { Select } from '../components/common/Select'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { Loader } from '../components/common/Loader'
import {
  useWeeklyAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  useAutoAssign,
  useClearWeekAssignments,
} from '../hooks/useAssignments'
import { toast } from '../store/toastStore'
import { TripGroupBasic, WeeklyDriverAssignment } from '../types/api'
import { useAuth } from '../hooks/useAuth'

// Day names for UAE week
const DAYS = [
  { value: 0, label: 'Saturday', short: 'Sat' },
  { value: 1, label: 'Sunday', short: 'Sun' },
  { value: 2, label: 'Monday', short: 'Mon' },
  { value: 3, label: 'Tuesday', short: 'Tue' },
  { value: 4, label: 'Wednesday', short: 'Wed' },
  { value: 5, label: 'Thursday', short: 'Thu' },
  { value: 6, label: 'Friday', short: 'Fri' },
]

// Get week start (Saturday) for a date
function getWeekStart(date: Date): Date {
  // UAE week starts on Saturday
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 1) % 7 // Saturday = 6 in JS, we need to go back to it
  d.setDate(d.getDate() - diff)
  return d
}

export function WeeklyAssignments() {
  const { canEdit } = useAuth()
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [autoAssignModalOpen, setAutoAssignModalOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<TripGroupBasic | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)
  const [minRestHours, setMinRestHours] = useState(12)

  const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd')
  const weekEndDate = addWeeks(currentWeekStart, 1)
  weekEndDate.setDate(weekEndDate.getDate() - 1)

  // Queries and mutations
  const { data, isLoading } = useWeeklyAssignments(weekStartStr)
  const createMutation = useCreateAssignment()
  const deleteMutation = useDeleteAssignment()
  const autoAssignMutation = useAutoAssign()
  const clearMutation = useClearWeekAssignments()

  // Driver options for select
  const driverOptions = useMemo(() => {
    return [
      { value: 0, label: 'Select driver...' },
      ...(data?.available_drivers || []).map((d) => ({
        value: d.id,
        label: d.name,
      })),
    ]
  }, [data?.available_drivers])

  // Group assignments and unassigned by day
  const assignmentsByDay = useMemo(() => {
    const byDay: Record<number, WeeklyDriverAssignment[]> = {}
    DAYS.forEach((d) => (byDay[d.value] = []))

    data?.assignments.forEach((a) => {
      const day = a.trip_group.day_of_week
      if (byDay[day]) {
        byDay[day].push(a)
      }
    })

    return byDay
  }, [data?.assignments])

  const unassignedByDay = useMemo(() => {
    const byDay: Record<number, TripGroupBasic[]> = {}
    DAYS.forEach((d) => (byDay[d.value] = []))

    data?.unassigned_groups.forEach((g) => {
      const day = g.day_of_week
      if (byDay[day]) {
        byDay[day].push(g)
      }
    })

    return byDay
  }, [data?.unassigned_groups])

  // Navigation
  const goToPreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1))
  }

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1))
  }

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()))
  }

  // Handlers
  const handleAssignClick = (group: TripGroupBasic) => {
    setSelectedGroup(group)
    setSelectedDriverId(null)
    setAssignModalOpen(true)
  }

  const handleCreateAssignment = async () => {
    if (!selectedGroup || !selectedDriverId) return
    try {
      await createMutation.mutateAsync({
        trip_group_id: selectedGroup.id,
        driver_id: selectedDriverId,
        week_start_date: weekStartStr,
      })
      toast.success('Driver assigned successfully')
      setAssignModalOpen(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign driver'
      toast.error(errorMessage)
    }
  }

  const handleDeleteAssignment = async (assignment: WeeklyDriverAssignment) => {
    try {
      await deleteMutation.mutateAsync(assignment.id)
      toast.success('Assignment removed')
    } catch {
      toast.error('Failed to remove assignment')
    }
  }

  const handleAutoAssign = async () => {
    try {
      const result = await autoAssignMutation.mutateAsync({
        week_start_date: weekStartStr,
        min_rest_hours: minRestHours,
        dry_run: false,
      })
      toast.success(result.message)
      setAutoAssignModalOpen(false)
    } catch {
      toast.error('Failed to auto-assign drivers')
    }
  }

  const handleClearWeek = async () => {
    try {
      await clearMutation.mutateAsync(weekStartStr)
      toast.success('All assignments cleared for this week')
      setClearConfirmOpen(false)
    } catch {
      toast.error('Failed to clear assignments')
    }
  }

  // Calculate total counts
  const totalAssigned = data?.assignments.length || 0
  const totalUnassigned = data?.unassigned_groups.length || 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Assignments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Assign drivers to trip groups for the week
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setClearConfirmOpen(true)}
              disabled={!data?.assignments.length}
            >
              <Trash2 className="h-4 w-4" />
              Clear Week
            </Button>
            <Button onClick={() => setAutoAssignModalOpen(true)}>
              <Wand2 className="h-4 w-4" />
              Auto-Assign
            </Button>
          </div>
        )}
      </div>

      {/* Week Navigation */}
      <Card>
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {format(currentWeekStart, 'MMM d')} - {format(weekEndDate, 'MMM d, yyyy')}
            </div>
            <button
              onClick={goToCurrentWeek}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Go to current week
            </button>
          </div>
          <Button variant="ghost" onClick={goToNextWeek}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalAssigned}</div>
              <div className="text-sm text-gray-500">Assigned</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalUnassigned}</div>
              <div className="text-sm text-gray-500">Unassigned</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{data?.available_drivers.length || 0}</div>
              <div className="text-sm text-gray-500">Available Drivers</div>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Day-by-day view */}
          {DAYS.map((day) => {
            const dayAssignments = assignmentsByDay[day.value] || []
            const dayUnassigned = unassignedByDay[day.value] || []
            const hasContent = dayAssignments.length > 0 || dayUnassigned.length > 0

            if (!hasContent) return null

            return (
              <Card key={day.value}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary-500" />
                    {day.label}
                    <Badge variant="secondary" className="ml-2">
                      {dayAssignments.length} assigned
                    </Badge>
                    {dayUnassigned.length > 0 && (
                      <Badge variant="warning" className="ml-1">
                        {dayUnassigned.length} unassigned
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>

                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Assigned Groups */}
                  {dayAssignments.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Assigned
                      </div>
                      <div className="space-y-2">
                        {dayAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Layers className="h-4 w-4 text-green-600" />
                              <div>
                                <div className="font-medium text-gray-900">
                                  {assignment.trip_group.name}
                                </div>
                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                  <Users className="h-3 w-3" />
                                  {assignment.driver.name}
                                </div>
                              </div>
                            </div>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAssignment(assignment)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unassigned Groups */}
                  {dayUnassigned.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Needs Assignment
                      </div>
                      <div className="space-y-2">
                        {dayUnassigned.map((group) => (
                          <div
                            key={group.id}
                            className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Layers className="h-4 w-4 text-yellow-600" />
                              <div>
                                <div className="font-medium text-gray-900">{group.name}</div>
                                {group.description && (
                                  <div className="text-sm text-gray-500 line-clamp-1">
                                    {group.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            {canEdit && (
                              <Button
                                size="sm"
                                onClick={() => handleAssignClick(group)}
                                disabled={!data?.available_drivers.length}
                              >
                                Assign
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}

          {/* Show message if no groups at all */}
          {totalAssigned === 0 && totalUnassigned === 0 && (
            <Card>
              <div className="text-center py-8">
                <Layers className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No trip groups</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create trip groups first to start assigning drivers.
                </p>
              </div>
            </Card>
          )}

          {/* Available Drivers */}
          {(data?.available_drivers.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Available Drivers ({data?.available_drivers.length || 0})
                </CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                {data?.available_drivers.map((driver) => (
                  <Badge key={driver.id} variant="secondary" className="text-sm">
                    {driver.name}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Manual Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={`Assign Driver to ${selectedGroup?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a driver to assign to this trip group for the week of{' '}
            {format(currentWeekStart, 'MMM d, yyyy')}.
          </p>
          {selectedGroup && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-500">Trip Group</div>
              <div className="font-medium">{selectedGroup.name}</div>
              <div className="text-sm text-gray-500 mt-1">Day: {selectedGroup.day_name}</div>
            </div>
          )}
          <Select
            label="Driver"
            options={driverOptions}
            value={selectedDriverId || 0}
            onChange={(e) => setSelectedDriverId(Number(e.target.value))}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateAssignment}
            disabled={!selectedDriverId}
            isLoading={createMutation.isPending}
          >
            Assign
          </Button>
        </ModalFooter>
      </Modal>

      {/* Auto-Assign Modal */}
      <Modal
        isOpen={autoAssignModalOpen}
        onClose={() => setAutoAssignModalOpen(false)}
        title="Auto-Assign Drivers"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Automatically assign available drivers to unassigned trip groups for the week of{' '}
            {format(currentWeekStart, 'MMM d, yyyy')}.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <h4 className="font-medium text-gray-900 mb-2">Assignment Rules:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Each driver gets ONE trip group for the whole week</li>
              <li>Drivers must be marked as WORKING for all weekdays</li>
              <li>Random selection among eligible drivers</li>
              <li>Groups with no eligible driver remain unassigned</li>
            </ul>
          </div>
          <Select
            label="Minimum Rest Hours (between shifts)"
            options={[
              { value: 10, label: '10 hours' },
              { value: 12, label: '12 hours (recommended)' },
              { value: 14, label: '14 hours' },
              { value: 16, label: '16 hours' },
            ]}
            value={minRestHours}
            onChange={(e) => setMinRestHours(Number(e.target.value))}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAutoAssignModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAutoAssign} isLoading={autoAssignMutation.isPending}>
            <Wand2 className="h-4 w-4" />
            Auto-Assign
          </Button>
        </ModalFooter>
      </Modal>

      {/* Clear Confirmation */}
      <ConfirmDialog
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={handleClearWeek}
        title="Clear All Assignments"
        message={`Are you sure you want to remove all driver assignments for the week of ${format(
          currentWeekStart,
          'MMM d, yyyy'
        )}? This action cannot be undone.`}
        confirmText="Clear All"
        isLoading={clearMutation.isPending}
      />
    </div>
  )
}
