import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, RefreshCw, Lock } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'

// Placeholder page - will be expanded in Sprint 3
export function DailySchedule() {
  const { date } = useParams()
  const [selectedDate, setSelectedDate] = useState(
    date ? new Date(date) : new Date()
  )

  const formattedDate = format(selectedDate, 'EEEE, d MMMM yyyy')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">{formattedDate}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <RefreshCw className="h-4 w-4" />
            Generate
          </Button>
          <Button variant="secondary">
            <Lock className="h-4 w-4" />
            Lock
          </Button>
        </div>
      </div>

      {/* Date navigation */}
      <Card>
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{format(selectedDate, 'dd MMM yyyy')}</span>
          </div>
          <Button variant="ghost" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Placeholder content */}
      <Card>
        <div className="py-12 text-center">
          <p className="text-gray-500">
            Schedule timeline and trip management will be implemented in Sprint 3.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Gantt-style timeline, trip assignments, and conflict detection coming soon.
          </p>
        </div>
      </Card>
    </div>
  )
}
