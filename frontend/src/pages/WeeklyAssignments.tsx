import { useState, useMemo } from 'react'
import { format, addWeeks, subWeeks, startOfWeek } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Wand2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Users,
  Layers,
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
import { TripGroupBasic, DriverBasic, WeeklyDriverAssignment } from '../types/api'
import { useAuth } from '../hooks/useAuth'

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
  const { data, isLoading, refetch } = useWeeklyAssignments(weekStartStr)
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
    } catch (error) {
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
    } catch (error) {
      toast.error('Failed to auto-assign drivers')
    }
  }

  const handleClearWeek = async () => {
    try {
      await clearMutation.mutateAsync(weekStartStr)
      toast.success('All assignments cleared for this week')
      setClearConfirmOpen(false)
    } catch (error) {
      toast.error('Failed to clear assignments')
    }
  }

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Assigned Groups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Assigned ({data?.assignments.length || 0})
              </CardTitle>
            </CardHeader>
            {data?.assignments.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">No assignments for this week</p>
            ) : (
              <div className="space-y-3">
                {data?.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {assignment.trip_group.name}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Users className="h-4 w-4" />
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
            )}
          </Card>

          {/* Unassigned Groups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Unassigned ({data?.unassigned_groups.length || 0})
              </CardTitle>
            </CardHeader>
            {data?.unassigned_groups.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">
                All groups have been assigned
              </p>
            ) : (
              <div className="space-y-3">
                {data?.unassigned_groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                        <Layers className="h-5 w-5" />
                      </div>
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
            )}
          </Card>

          {/* Available Drivers */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Available Drivers ({data?.available_drivers.length || 0})
              </CardTitle>
            </CardHeader>
            {data?.available_drivers.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">
                All drivers have been assigned
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data?.available_drivers.map((driver) => (
                  <Badge key={driver.id} variant="secondary" className="text-sm">
                    {driver.name}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
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
