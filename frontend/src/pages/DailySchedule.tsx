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
  Plus,
  Users,
} from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { Select } from '../components/common/Select'
import { Input } from '../components/common/Input'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import {
  useScheduleByGroups,
  useGenerateSchedule,
  useLockSchedule,
  useUnlockSchedule,
  useUpdateTrip,
  useCreateOnDemandDelivery,
} from '../hooks/useSchedules'
import { useTankers, useCompatibleTankers } from '../hooks/useTankers'
import { useDrivers } from '../hooks/useDrivers'
import { useCustomers } from '../hooks/useCustomers'
import { useFuelBlends } from '../hooks/useReferenceData'
import { toast } from '../store/toastStore'
import { Trip, TripStatus, TripGroupScheduleItem } from '../types/api'
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

// On-demand delivery form schema
const onDemandSchema = z.object({
  customer_id: z.coerce.number().min(1, 'Customer is required'),
  fuel_blend_id: z.coerce.number().nullable().optional(),
  volume: z.coerce.number().min(1, 'Volume must be at least 1'),
  preferred_start_time: z.string().optional(),
  preferred_end_time: z.string().optional(),
  notes: z.string().nullable().optional(),
  auto_assign: z.boolean().default(true),
})

type OnDemandFormData = z.infer<typeof onDemandSchema>

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
  const [onDemandModalOpen, setOnDemandModalOpen] = useState(false)

  // Format date for API
  const dateString = format(selectedDate, 'yyyy-MM-dd')

  // Queries - use the new group-based endpoint
  const { data: scheduleData, isLoading, refetch } = useScheduleByGroups(dateString)
  const { data: tankersData } = useTankers({ is_active: true, per_page: 100 })
  const { data: driversData } = useDrivers({ is_active: true, per_page: 100 })
  const { data: customersData } = useCustomers({ is_active: true, per_page: 100 })
  const { data: fuelBlendsData } = useFuelBlends()
  const { data: compatibleTankers } = useCompatibleTankers(
    selectedTrip?.customer?.id || 0
  )

  // Mutations
  const generateMutation = useGenerateSchedule()
  const lockMutation = useLockSchedule()
  const unlockMutation = useUnlockSchedule()
  const updateTripMutation = useUpdateTrip()
  const onDemandMutation = useCreateOnDemandDelivery()

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

  // Form for on-demand delivery
  const {
    register: registerOnDemand,
    handleSubmit: handleSubmitOnDemand,
    control: controlOnDemand,
    reset: resetOnDemand,
    watch: watchOnDemand,
    formState: { errors: errorsOnDemand },
  } = useForm<OnDemandFormData>({
    resolver: zodResolver(onDemandSchema),
    defaultValues: {
      auto_assign: true,
      preferred_start_time: '08:00',
      preferred_end_time: '10:00',
    },
  })

  // Customer options
  const customerOptions = useMemo(() => {
    return [
      { value: 0, label: 'Select customer...' },
      ...(customersData?.items || []).map((c) => ({
        value: c.id,
        label: `${c.code} - ${c.name}`,
      })),
    ]
  }, [customersData])

  // Fuel blend options
  const fuelBlendOptions = useMemo(() => {
    return [
      { value: 0, label: 'Default (from customer)' },
      ...(fuelBlendsData || []).map((b) => ({
        value: b.id,
        label: `${b.code} - ${b.name}`,
      })),
    ]
  }, [fuelBlendsData])

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
    if (!canEdit || scheduleData?.is_locked) return
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
      if (scheduleData?.is_locked) {
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

  // On-demand delivery
  const handleOpenOnDemand = () => {
    resetOnDemand({
      auto_assign: true,
      preferred_start_time: '08:00',
      preferred_end_time: '10:00',
    })
    setOnDemandModalOpen(true)
  }

  const onSubmitOnDemand = async (data: OnDemandFormData) => {
    try {
      const result = await onDemandMutation.mutateAsync({
        date: dateString,
        customer_id: data.customer_id,
        fuel_blend_id: data.fuel_blend_id === 0 ? null : data.fuel_blend_id,
        volume: data.volume,
        preferred_start_time: data.preferred_start_time || null,
        preferred_end_time: data.preferred_end_time || null,
        notes: data.notes,
        auto_assign: data.auto_assign,
      })
      toast.success(result.message)
      setOnDemandModalOpen(false)
      refetch()
    } catch (error) {
      toast.error('Failed to create on-demand delivery')
    }
  }

  // Calculate trip/group position on timeline
  const getTimePosition = (startTime: string, endTime: string) => {
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    const startMinutes = (startHour - 6) * 60 + startMin
    const endMinutes = (endHour - 6) * 60 + endMin
    const totalMinutes = 16 * 60 // 6 AM to 10 PM

    const left = (startMinutes / totalMinutes) * 100
    const width = ((endMinutes - startMinutes) / totalMinutes) * 100

    return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, Math.max(width, 5))}%` }
  }

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
              onClick={handleOpenOnDemand}
              disabled={scheduleData?.is_locked}
            >
              <Plus className="h-4 w-4" />
              On-Demand
            </Button>
            <Button
              variant="secondary"
              onClick={() => setGenerateDialogOpen(true)}
              disabled={scheduleData?.is_locked}
            >
              <RefreshCw className="h-4 w-4" />
              Generate
            </Button>
            <Button
              variant={scheduleData?.is_locked ? 'primary' : 'secondary'}
              onClick={handleToggleLock}
              isLoading={lockMutation.isPending || unlockMutation.isPending}
            >
              {scheduleData?.is_locked ? (
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
      {scheduleData && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {scheduleData.summary.total_trips}
            </div>
            <div className="text-sm text-gray-500">Total Trips</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {scheduleData.summary.assigned_trips}
            </div>
            <div className="text-sm text-gray-500">Assigned</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {scheduleData.summary.unassigned_trips}
            </div>
            <div className="text-sm text-gray-500">Unassigned</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {scheduleData.summary.conflict_trips}
            </div>
            <div className="text-sm text-gray-500">Conflicts</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatVolume(scheduleData.summary.total_volume)}
            </div>
            <div className="text-sm text-gray-500">Total Volume</div>
          </Card>
        </div>
      )}

      {/* Trip Groups Gantt View */}
      <Card padding="none">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-500" />
            Trip Groups Schedule
          </h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : !scheduleData || (scheduleData.trip_groups.length === 0 && scheduleData.unassigned_trips.trips.length === 0) ? (
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
              <div className="w-56 flex-shrink-0 border-r px-4 py-2 font-medium text-gray-700">
                Trip Group / Driver
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

            {/* Trip Group rows */}
            {scheduleData.trip_groups.map((group) => (
              <TripGroupRow
                key={group.id}
                group={group}
                getTimePosition={getTimePosition}
                onTripClick={handleTripClick}
                isLocked={scheduleData.is_locked}
                canEdit={canEdit}
                statusVariants={statusVariants}
              />
            ))}

            {/* Unassigned/Ad-hoc trips */}
            {scheduleData.unassigned_trips.trips.length > 0 && (
              <div className="flex border-b border-t-2 border-t-yellow-300">
                <div className="w-56 flex-shrink-0 border-r bg-yellow-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Ad-hoc / Unassigned</span>
                  </div>
                  <div className="mt-1 text-xs text-yellow-600">
                    {scheduleData.unassigned_trips.trips.length} trip(s) - {formatVolume(scheduleData.unassigned_trips.total_volume)}
                  </div>
                </div>
                <div className="relative flex-1 bg-yellow-50/30" style={{ minHeight: '70px' }}>
                  {/* Background grid */}
                  <div className="absolute inset-0 flex">
                    {TIME_SLOTS.map((slot) => (
                      <div
                        key={slot.value}
                        className="flex-1 border-r border-yellow-200"
                        style={{ minWidth: '60px' }}
                      />
                    ))}
                  </div>
                  {/* Trips */}
                  {scheduleData.unassigned_trips.trips.map((trip) => {
                    const position = getTimePosition(trip.start_time, trip.end_time)
                    return (
                      <div
                        key={trip.id}
                        className="absolute top-2 bottom-2 rounded px-2 py-1 text-xs cursor-pointer transition-transform hover:scale-[1.02] bg-yellow-100 border-2 border-yellow-400"
                        style={{
                          left: position.left,
                          width: position.width,
                          minWidth: '80px',
                        }}
                        onClick={() => handleTripClick(trip)}
                        title={`${trip.customer.code}: ${formatTime(trip.start_time)} - ${formatTime(trip.end_time)}`}
                      >
                        <div className="font-medium truncate">{trip.customer.code}</div>
                        <div className="truncate text-yellow-700">{formatVolume(trip.volume)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

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

      {/* On-Demand Delivery Modal */}
      <Modal
        isOpen={onDemandModalOpen}
        onClose={() => setOnDemandModalOpen(false)}
        title="Add On-Demand Delivery"
        size="lg"
      >
        <form onSubmit={handleSubmitOnDemand(onSubmitOnDemand)}>
          <div className="space-y-4">
            <Controller
              name="customer_id"
              control={controlOnDemand}
              render={({ field }) => (
                <Select
                  label="Customer"
                  options={customerOptions}
                  value={field.value || 0}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  error={errorsOnDemand.customer_id?.message}
                />
              )}
            />

            <Controller
              name="fuel_blend_id"
              control={controlOnDemand}
              render={({ field }) => (
                <Select
                  label="Fuel Blend"
                  options={fuelBlendOptions}
                  value={field.value || 0}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  error={errorsOnDemand.fuel_blend_id?.message}
                />
              )}
            />

            <Input
              label="Volume (L)"
              type="number"
              {...registerOnDemand('volume')}
              error={errorsOnDemand.volume?.message}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Preferred Start Time"
                type="time"
                {...registerOnDemand('preferred_start_time')}
                error={errorsOnDemand.preferred_start_time?.message}
              />
              <Input
                label="Preferred End Time"
                type="time"
                {...registerOnDemand('preferred_end_time')}
                error={errorsOnDemand.preferred_end_time?.message}
              />
            </div>

            <Input
              label="Notes"
              {...registerOnDemand('notes')}
              error={errorsOnDemand.notes?.message}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_assign"
                {...registerOnDemand('auto_assign')}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="auto_assign" className="text-sm text-gray-700">
                Auto-assign to compatible tanker
              </label>
            </div>
          </div>

          <ModalFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setOnDemandModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={onDemandMutation.isPending}>
              Create Delivery
            </Button>
          </ModalFooter>
        </form>
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

// Trip Group Row Component
interface TripGroupRowProps {
  group: TripGroupScheduleItem
  getTimePosition: (startTime: string, endTime: string) => { left: string; width: string }
  onTripClick: (trip: Trip) => void
  isLocked: boolean
  canEdit: boolean
  statusVariants: Record<TripStatus, 'success' | 'warning' | 'danger' | 'secondary' | 'info'>
}

function TripGroupRow({
  group,
  getTimePosition,
  onTripClick,
  isLocked,
  canEdit,
  statusVariants,
}: TripGroupRowProps) {
  // Calculate group bar position
  const groupPosition = group.earliest_start_time && group.latest_end_time
    ? getTimePosition(group.earliest_start_time, group.latest_end_time)
    : null

  const hasDriver = !!group.driver
  const hasTrips = group.trips.length > 0

  return (
    <div className="flex border-b">
      {/* Group info */}
      <div className={`w-56 flex-shrink-0 border-r px-4 py-3 ${!hasDriver ? 'bg-red-50' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${hasDriver ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="font-medium text-gray-900 truncate">{group.name}</span>
        </div>
        {group.driver ? (
          <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
            <User className="h-3.5 w-3.5 text-gray-400" />
            <span>{group.driver.name}</span>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-1.5 text-sm text-red-600">
            <User className="h-3.5 w-3.5" />
            <span>No driver assigned</span>
          </div>
        )}
        <div className="mt-1 text-xs text-gray-500">
          {group.trips.length} trip(s) - {formatVolume(group.total_volume)}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative flex-1" style={{ minHeight: '80px' }}>
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

        {/* Group span bar (background) */}
        {groupPosition && (
          <div
            className={`absolute top-0 bottom-0 ${hasDriver ? 'bg-primary-50/50' : 'bg-red-50/50'} border-l-4 ${hasDriver ? 'border-l-primary-400' : 'border-l-red-400'}`}
            style={{
              left: groupPosition.left,
              width: groupPosition.width,
            }}
          />
        )}

        {/* Individual trips */}
        {group.trips.map((trip, idx) => {
          const position = getTimePosition(trip.start_time, trip.end_time)
          const topOffset = 8 + (idx * 2) // Slight stagger if needed
          return (
            <div
              key={trip.id}
              className={`absolute rounded px-2 py-1 text-xs transition-transform ${
                canEdit && !isLocked ? 'cursor-pointer hover:scale-[1.02]' : ''
              } ${
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
                top: `${topOffset}px`,
                height: 'calc(100% - 16px)',
                maxHeight: '56px',
              }}
              onClick={() => onTripClick(trip)}
              title={`${trip.customer.code}: ${formatTime(trip.start_time)} - ${formatTime(trip.end_time)}`}
            >
              <div className="font-medium truncate">{trip.customer.code}</div>
              <div className="truncate text-gray-600 flex items-center gap-1">
                <Droplet className="h-3 w-3 text-blue-500" />
                {formatVolume(trip.volume)}
              </div>
              {trip.tanker && (
                <div className="truncate text-gray-500 flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {trip.tanker.name}
                </div>
              )}
            </div>
          )
        })}

        {/* Empty group placeholder */}
        {!hasTrips && groupPosition && (
          <div
            className="absolute top-2 bottom-2 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs"
            style={{
              left: groupPosition.left,
              width: groupPosition.width,
              minWidth: '100px',
            }}
          >
            No trips generated
          </div>
        )}
      </div>
    </div>
  )
}
