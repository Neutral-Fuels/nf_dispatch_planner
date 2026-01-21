import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays, subDays, parseISO } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  Truck,
  User,
  Droplet,
  Edit2,
} from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { Select } from '../components/common/Select'
import { Input } from '../components/common/Input'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import {
  useDailySchedule,
  useGenerateSchedule,
  useLockSchedule,
  useUnlockSchedule,
  useUpdateTrip,
} from '../hooks/useSchedules'
import { useTankers, useCompatibleTankers } from '../hooks/useTankers'
import { useDrivers } from '../hooks/useDrivers'
import { toast } from '../store/toastStore'
import { Trip, TripStatus } from '../types/api'
import { formatTime, formatVolume } from '../utils/formatters'
import { useAuth } from '../hooks/useAuth'

// Trip assignment form schema
const tripAssignmentSchema = z.object({
  tanker_id: z.coerce.number().nullable(),
  driver_id: z.coerce.number().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  volume: z.coerce.number().min(1),
  notes: z.string().nullable().optional(),
})

type TripAssignmentFormData = z.infer<typeof tripAssignmentSchema>

// Time slots for timeline (6 AM to 10 PM)
const TIME_SLOTS = Array.from({ length: 17 }, (_, i) => {
  const hour = i + 6
  return {
    label: `${hour.toString().padStart(2, '0')}:00`,
    value: hour,
  }
})

export function DailySchedule() {
  const { date: urlDate } = useParams()
  const navigate = useNavigate()
  const { canEdit } = useAuth()

  const [selectedDate, setSelectedDate] = useState(() => {
    if (urlDate) {
      try {
        return parseISO(urlDate)
      } catch {
        return new Date()
      }
    }
    return new Date()
  })

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)

  // Format date for API
  const dateString = format(selectedDate, 'yyyy-MM-dd')

  // Queries
  const { data: schedule, isLoading, refetch } = useDailySchedule(dateString)
  const { data: tankersData } = useTankers({ is_active: true, per_page: 100 })
  const { data: driversData } = useDrivers({ is_active: true, per_page: 100 })
  const { data: compatibleTankers } = useCompatibleTankers(
    selectedTrip?.customer?.id || 0
  )

  // Mutations
  const generateMutation = useGenerateSchedule()
  const lockMutation = useLockSchedule()
  const unlockMutation = useUnlockSchedule()
  const updateTripMutation = useUpdateTrip()

  // Form for trip assignment
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TripAssignmentFormData>({
    resolver: zodResolver(tripAssignmentSchema),
  })

  // Tanker options (compatible tankers first)
  const tankerOptions = useMemo(() => {
    const allTankers = tankersData?.items || []
    const compatible = compatibleTankers || []
    const compatibleIds = new Set(compatible.map((t) => t.id))

    return [
      { value: 0, label: 'Unassigned' },
      ...compatible.map((t) => ({
        value: t.id,
        label: `${t.name} (${formatVolume(t.max_capacity)}) - Compatible`,
      })),
      ...allTankers
        .filter((t) => !compatibleIds.has(t.id))
        .map((t) => ({
          value: t.id,
          label: `${t.name} (${formatVolume(t.max_capacity)})`,
        })),
    ]
  }, [tankersData, compatibleTankers])

  // Driver options
  const driverOptions = useMemo(() => {
    return [
      { value: 0, label: 'Unassigned' },
      ...(driversData?.items || []).map((d) => ({
        value: d.id,
        label: d.name,
      })),
    ]
  }, [driversData])

  // Status badge variants
  const statusVariants: Record<TripStatus, 'success' | 'warning' | 'danger' | 'secondary' | 'info'> = {
    scheduled: 'info',
    unassigned: 'warning',
    conflict: 'danger',
    completed: 'success',
    cancelled: 'secondary',
  }

  // Navigation handlers
  const goToPreviousDay = () => {
    const newDate = subDays(selectedDate, 1)
    setSelectedDate(newDate)
    navigate(`/schedule/${format(newDate, 'yyyy-MM-dd')}`, { replace: true })
  }

  const goToNextDay = () => {
    const newDate = addDays(selectedDate, 1)
    setSelectedDate(newDate)
    navigate(`/schedule/${format(newDate, 'yyyy-MM-dd')}`, { replace: true })
  }

  const goToToday = () => {
    const today = new Date()
    setSelectedDate(today)
    navigate(`/schedule/${format(today, 'yyyy-MM-dd')}`, { replace: true })
  }

  // Trip handlers
  const handleTripClick = (trip: Trip) => {
    if (!canEdit || schedule?.is_locked) return
    setSelectedTrip(trip)
    reset({
      tanker_id: trip.tanker?.id || null,
      driver_id: trip.driver?.id || null,
      start_time: trip.start_time,
      end_time: trip.end_time,
      volume: trip.volume,
      notes: trip.notes,
    })
    setAssignmentModalOpen(true)
  }

  const onSubmitAssignment = async (data: TripAssignmentFormData) => {
    if (!selectedTrip) return
    try {
      await updateTripMutation.mutateAsync({
        id: selectedTrip.id,
        tanker_id: data.tanker_id === 0 ? null : data.tanker_id,
        driver_id: data.driver_id === 0 ? null : data.driver_id,
        start_time: data.start_time,
        end_time: data.end_time,
        volume: data.volume,
        notes: data.notes,
      })
      toast.success('Trip updated successfully')
      setAssignmentModalOpen(false)
      refetch()
    } catch (error) {
      toast.error('Failed to update trip')
    }
  }

  // Generate schedule
  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({ date: dateString, overwrite: true })
      toast.success('Schedule generated successfully')
      setGenerateDialogOpen(false)
      refetch()
    } catch (error) {
      toast.error('Failed to generate schedule')
    }
  }

  // Lock/unlock schedule
  const handleToggleLock = async () => {
    try {
      if (schedule?.is_locked) {
        await unlockMutation.mutateAsync(dateString)
        toast.success('Schedule unlocked')
      } else {
        await lockMutation.mutateAsync(dateString)
        toast.success('Schedule locked')
      }
      refetch()
    } catch (error) {
      toast.error('Failed to update schedule lock')
    }
  }

  // Calculate trip position on timeline
  const getTripPosition = (trip: Trip) => {
    const [startHour, startMin] = trip.start_time.split(':').map(Number)
    const [endHour, endMin] = trip.end_time.split(':').map(Number)

    const startMinutes = (startHour - 6) * 60 + startMin
    const endMinutes = (endHour - 6) * 60 + endMin
    const totalMinutes = 16 * 60 // 6 AM to 10 PM

    const left = (startMinutes / totalMinutes) * 100
    const width = ((endMinutes - startMinutes) / totalMinutes) * 100

    return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }
  }

  // Group trips by tanker
  const tripsByTanker = useMemo(() => {
    if (!schedule?.trips) return new Map<string, Trip[]>()

    const grouped = new Map<string, Trip[]>()
    grouped.set('unassigned', [])

    schedule.trips.forEach((trip) => {
      const key = trip.tanker ? `tanker-${trip.tanker.id}` : 'unassigned'
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(trip)
    })

    return grouped
  }, [schedule?.trips])

  const formattedDate = format(selectedDate, 'EEEE, d MMMM yyyy')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">{formattedDate}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setGenerateDialogOpen(true)}
              disabled={schedule?.is_locked}
            >
              <RefreshCw className="h-4 w-4" />
              Generate
            </Button>
            <Button
              variant={schedule?.is_locked ? 'primary' : 'secondary'}
              onClick={handleToggleLock}
              isLoading={lockMutation.isPending || unlockMutation.isPending}
            >
              {schedule?.is_locked ? (
                <>
                  <Unlock className="h-4 w-4" />
                  Unlock
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Lock
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Date navigation */}
      <Card>
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={dateString}
              onChange={(e) => {
                const newDate = parseISO(e.target.value)
                setSelectedDate(newDate)
                navigate(`/schedule/${e.target.value}`, { replace: true })
              }}
              className="border-0 text-center font-medium focus:outline-none focus:ring-0"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
      </Card>

      {/* Summary stats */}
      {schedule && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {schedule.summary.total_trips}
            </div>
            <div className="text-sm text-gray-500">Total Trips</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {schedule.summary.assigned_trips}
            </div>
            <div className="text-sm text-gray-500">Assigned</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {schedule.summary.unassigned_trips}
            </div>
            <div className="text-sm text-gray-500">Unassigned</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {schedule.summary.conflict_trips}
            </div>
            <div className="text-sm text-gray-500">Conflicts</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatVolume(schedule.summary.total_volume)}
            </div>
            <div className="text-sm text-gray-500">Total Volume</div>
          </Card>
        </div>
      )}

      {/* Timeline view */}
      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : !schedule || schedule.trips.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500">No trips scheduled for this day.</p>
            {canEdit && (
              <Button className="mt-4" onClick={() => setGenerateDialogOpen(true)}>
                <RefreshCw className="h-4 w-4" />
                Generate from Template
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Time header */}
            <div className="flex border-b bg-gray-50">
              <div className="w-48 flex-shrink-0 border-r px-4 py-2 font-medium text-gray-700">
                Tanker / Driver
              </div>
              <div className="flex flex-1">
                {TIME_SLOTS.map((slot) => (
                  <div
                    key={slot.value}
                    className="flex-1 border-r px-2 py-2 text-center text-xs text-gray-500"
                    style={{ minWidth: '60px' }}
                  >
                    {slot.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Trip rows */}
            {Array.from(tripsByTanker.entries()).map(([key, trips]) => {
              if (trips.length === 0) return null

              const tanker = trips[0].tanker
              const isUnassigned = key === 'unassigned'

              return (
                <div key={key} className="flex border-b">
                  <div className="w-48 flex-shrink-0 border-r px-4 py-3">
                    {isUnassigned ? (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Unassigned</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          <Truck className="h-4 w-4 text-primary-500" />
                          {tanker?.name}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative flex-1" style={{ minHeight: '60px' }}>
                    {/* Background grid */}
                    <div className="absolute inset-0 flex">
                      {TIME_SLOTS.map((slot) => (
                        <div
                          key={slot.value}
                          className="flex-1 border-r"
                          style={{ minWidth: '60px' }}
                        />
                      ))}
                    </div>
                    {/* Trips */}
                    {trips.map((trip) => {
                      const position = getTripPosition(trip)
                      return (
                        <div
                          key={trip.id}
                          className={`absolute top-1 bottom-1 rounded px-2 py-1 text-xs cursor-pointer transition-transform hover:scale-[1.02] ${
                            trip.status === 'conflict'
                              ? 'bg-red-100 border-2 border-red-400'
                              : trip.status === 'unassigned'
                              ? 'bg-yellow-100 border-2 border-yellow-400'
                              : trip.status === 'completed'
                              ? 'bg-green-100 border border-green-300'
                              : 'bg-blue-100 border border-blue-300'
                          }`}
                          style={{
                            left: position.left,
                            width: position.width,
                            minWidth: '80px',
                          }}
                          onClick={() => handleTripClick(trip)}
                          title={`${trip.customer.code}: ${formatTime(trip.start_time)} - ${formatTime(trip.end_time)}`}
                        >
                          <div className="font-medium truncate">
                            {trip.customer.code}
                          </div>
                          <div className="truncate text-gray-600">
                            {formatVolume(trip.volume)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Trip list view */}
      {schedule && schedule.trips.length > 0 && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Trip Details</h3>
          <div className="space-y-3">
            {schedule.trips
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((trip) => (
                <div
                  key={trip.id}
                  className={`rounded-lg border p-4 ${
                    canEdit && !schedule.is_locked ? 'cursor-pointer hover:bg-gray-50' : ''
                  }`}
                  onClick={() => handleTripClick(trip)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-gray-900">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">
                            {formatTime(trip.start_time)} - {formatTime(trip.end_time)}
                          </span>
                        </div>
                        <Badge variant={statusVariants[trip.status]}>
                          {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="mt-2 text-lg font-semibold text-gray-900">
                        {trip.customer.code} - {trip.customer.name}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Droplet className="h-4 w-4 text-blue-500" />
                          <span>{formatVolume(trip.volume)}</span>
                          {trip.fuel_blend && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {trip.fuel_blend.code}
                            </Badge>
                          )}
                        </div>
                        {trip.tanker ? (
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-4 w-4 text-primary-500" />
                            <span>{trip.tanker.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-yellow-600">
                            <Truck className="h-4 w-4" />
                            <span>No tanker</span>
                          </div>
                        )}
                        {trip.driver ? (
                          <div className="flex items-center gap-1.5">
                            <User className="h-4 w-4 text-gray-500" />
                            <span>{trip.driver.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-yellow-600">
                            <User className="h-4 w-4" />
                            <span>No driver</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {canEdit && !schedule.is_locked && (
                      <Button variant="ghost" size="sm">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Trip Assignment Modal */}
      <Modal
        isOpen={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        title="Edit Trip Assignment"
        size="lg"
      >
        {selectedTrip && (
          <form onSubmit={handleSubmit(onSubmitAssignment)}>
            <div className="mb-4 rounded-lg bg-gray-50 p-3">
              <div className="font-semibold text-gray-900">
                {selectedTrip.customer.code} - {selectedTrip.customer.name}
              </div>
              <div className="text-sm text-gray-600">
                {formatTime(selectedTrip.start_time)} - {formatTime(selectedTrip.end_time)}
              </div>
            </div>

            <div className="space-y-4">
              <Controller
                name="tanker_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Tanker"
                    options={tankerOptions}
                    value={field.value || 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    error={errors.tanker_id?.message}
                  />
                )}
              />

              <Controller
                name="driver_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Driver"
                    options={driverOptions}
                    value={field.value || 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    error={errors.driver_id?.message}
                  />
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Time"
                  type="time"
                  {...register('start_time')}
                  error={errors.start_time?.message}
                />
                <Input
                  label="End Time"
                  type="time"
                  {...register('end_time')}
                  error={errors.end_time?.message}
                />
              </div>

              <Input
                label="Volume (L)"
                type="number"
                {...register('volume')}
                error={errors.volume?.message}
              />

              <Input
                label="Notes"
                {...register('notes')}
                error={errors.notes?.message}
              />
            </div>

            <ModalFooter>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setAssignmentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={updateTripMutation.isPending}>
                Save Changes
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* Generate Schedule Confirmation */}
      <ConfirmDialog
        isOpen={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        onConfirm={handleGenerate}
        title="Generate Schedule"
        message={`This will generate the schedule for ${formattedDate} from weekly templates. Existing trips will be replaced. Continue?`}
        confirmText="Generate"
        variant="warning"
        isLoading={generateMutation.isPending}
      />
    </div>
  )
}
