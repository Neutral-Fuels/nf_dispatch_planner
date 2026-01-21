import { useState, useMemo } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Printer, User, Truck, Phone, FileText, Clock } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Select } from '../components/common/Select'
import { Badge } from '../components/common/Badge'
import { useDrivers } from '../hooks/useDrivers'
import { useDriverTripSheet, TripSheetTrip } from '../hooks/useDriverSchedule'
import { formatVolume, formatTime } from '../utils/formatters'

// Trip status colors
const TRIP_STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'secondary' }> = {
  scheduled: { label: 'Scheduled', variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
}

export function DriverTripSheet() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)

  // Fetch drivers
  const { data: driversData } = useDrivers({ is_active: true, per_page: 100 })

  // Fetch trip sheet when driver and date are selected
  const { data: tripSheet, isLoading } = useDriverTripSheet(
    selectedDriverId || 0,
    selectedDate
  )

  // Driver options
  const driverOptions = useMemo(() => {
    return [
      { value: 0, label: 'Select a driver...' },
      ...(driversData?.items || []).map((d) => ({
        value: d.id,
        label: d.name,
      })),
    ]
  }, [driversData])

  // Date navigation
  const goToPreviousDay = () => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))
  const goToNextDay = () => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))
  const goToToday = () => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))

  // Print handler
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header - hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Trip Sheet</h1>
          <p className="mt-1 text-sm text-gray-500">
            Printable daily trip assignment sheet for drivers
          </p>
        </div>
        <Button onClick={handlePrint} disabled={!tripSheet}>
          <Printer className="h-4 w-4" />
          Print Trip Sheet
        </Button>
      </div>

      {/* Controls - hidden in print */}
      <Card className="print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Select
              label="Select Driver"
              options={driverOptions}
              value={selectedDriverId || 0}
              onChange={(e) => setSelectedDriverId(Number(e.target.value) || null)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] text-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
        </div>
      </Card>

      {/* Trip Sheet Content */}
      {!selectedDriverId ? (
        <Card className="print:hidden">
          <div className="py-12 text-center text-gray-500">
            <User className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4">Select a driver to view their trip sheet</p>
          </div>
        </Card>
      ) : isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        </Card>
      ) : !tripSheet ? (
        <Card className="print:hidden">
          <div className="py-12 text-center text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4">No trip sheet found for this driver and date</p>
          </div>
        </Card>
      ) : (
        <div className="trip-sheet-printable">
          {/* Print Header */}
          <div className="hidden print:block mb-6">
            <div className="flex items-center justify-between border-b-2 border-gray-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-900 text-white font-bold text-lg">
                  NF
                </div>
                <div>
                  <div className="text-xl font-bold">Neutral Fuels</div>
                  <div className="text-sm text-gray-600">Dispatch Planner</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">DRIVER TRIP SHEET</div>
                <div className="text-sm text-gray-600">
                  {format(new Date(selectedDate), 'EEEE, d MMMM yyyy')}
                </div>
              </div>
            </div>
          </div>

          {/* Driver Info Card */}
          <Card className="mb-6 print:border-2 print:border-gray-900 print:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600 print:bg-gray-100 print:text-gray-900">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{tripSheet.driver_name}</h2>
                  {tripSheet.driver_license && (
                    <div className="text-sm text-gray-600">License: {tripSheet.driver_license}</div>
                  )}
                  {tripSheet.driver_phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Phone className="h-3 w-3" />
                      {tripSheet.driver_phone}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right print:hidden">
                <div className="text-lg font-semibold text-gray-900">
                  {format(new Date(selectedDate), 'EEEE, d MMMM yyyy')}
                </div>
                <Badge
                  variant={tripSheet.status === 'working' ? 'success' : 'secondary'}
                  className="mt-1"
                >
                  {tripSheet.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 grid grid-cols-4 gap-4 border-t pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{tripSheet.summary.total_trips}</div>
                <div className="text-xs text-gray-500 uppercase">Total Trips</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 print:text-gray-900">
                  {formatVolume(tripSheet.summary.total_volume)}
                </div>
                <div className="text-xs text-gray-500 uppercase">Total Volume</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 print:text-gray-900">
                  {tripSheet.summary.completed_trips}
                </div>
                <div className="text-xs text-gray-500 uppercase">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 print:text-gray-900">
                  {tripSheet.summary.remaining_trips}
                </div>
                <div className="text-xs text-gray-500 uppercase">Remaining</div>
              </div>
            </div>
          </Card>

          {/* Trips Table */}
          {tripSheet.trips.length === 0 ? (
            <Card>
              <div className="py-12 text-center text-gray-500">
                <Truck className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4">No trips assigned for this date</p>
              </div>
            </Card>
          ) : (
            <Card padding="none" className="print:border-2 print:border-gray-900 print:shadow-none">
              <table className="min-w-full">
                <thead className="bg-gray-50 print:bg-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-700 print:border-b print:border-gray-900">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-700 print:border-b print:border-gray-900">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-700 print:border-b print:border-gray-900">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-700 print:border-b print:border-gray-900">
                      Tanker
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-700 print:border-b print:border-gray-900">
                      Fuel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-700 print:border-b print:border-gray-900">
                      Volume
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-700 print:border-b print:border-gray-900 print:hidden">
                      Status
                    </th>
                    <th className="hidden print:table-cell px-4 py-3 text-center text-xs font-semibold uppercase text-gray-700 print:border-b print:border-gray-900">
                      Signature
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 print:divide-gray-400">
                  {tripSheet.trips.map((trip: TripSheetTrip) => {
                    const statusConfig = TRIP_STATUS_CONFIG[trip.status] || TRIP_STATUS_CONFIG.scheduled
                    return (
                      <tr key={trip.id} className="print:break-inside-avoid">
                        <td className="px-4 py-3 print:border-b print:border-gray-300">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                            {trip.sequence}
                          </div>
                        </td>
                        <td className="px-4 py-3 print:border-b print:border-gray-300">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-gray-400 print:hidden" />
                            <div>
                              <div className="font-medium text-gray-900">{formatTime(trip.start_time)}</div>
                              <div className="text-xs text-gray-500">to {formatTime(trip.end_time)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 print:border-b print:border-gray-300">
                          <div className="font-medium text-gray-900">{trip.customer_name}</div>
                          <div className="text-xs text-gray-500">{trip.customer_code}</div>
                          {trip.customer_address && (
                            <div className="mt-1 text-xs text-gray-400 max-w-[200px] truncate print:max-w-none print:whitespace-normal">
                              {trip.customer_address}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 print:border-b print:border-gray-300">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-gray-400 print:hidden" />
                            <div>
                              <div className="font-medium text-gray-900">{trip.tanker_code}</div>
                              <div className="text-xs text-gray-500">{formatVolume(trip.tanker_capacity)} cap</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 print:border-b print:border-gray-300">
                          <Badge variant="info" className="print:bg-gray-200 print:text-gray-900">
                            {trip.fuel_blend}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right print:border-b print:border-gray-300">
                          <div className="text-lg font-bold text-gray-900">{formatVolume(trip.volume)}</div>
                        </td>
                        <td className="px-4 py-3 text-center print:hidden">
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </td>
                        <td className="hidden print:table-cell px-4 py-3 print:border-b print:border-gray-300">
                          <div className="h-8 border-b border-gray-400 min-w-[100px]"></div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {/* Notes section for print */}
          <div className="hidden print:block mt-6">
            <Card className="print:border-2 print:border-gray-900 print:shadow-none">
              <h3 className="font-bold text-gray-900 mb-2">Notes:</h3>
              <div className="border-b border-gray-300 py-2"></div>
              <div className="border-b border-gray-300 py-2"></div>
              <div className="border-b border-gray-300 py-2"></div>
            </Card>
          </div>

          {/* Footer for print */}
          <div className="hidden print:block mt-8 text-center text-sm text-gray-500">
            <div>Generated on {format(new Date(), 'dd/MM/yyyy HH:mm')} | NF Dispatch Planner</div>
          </div>
        </div>
      )}
    </div>
  )
}
