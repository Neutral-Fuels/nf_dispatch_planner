import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { DAY_NAMES } from '../utils/constants'

// Placeholder page - will be expanded in Sprint 3
export function WeeklyTemplates() {
  const [selectedDay, setSelectedDay] = useState(0)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Recurring schedule templates for each day of the week
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Add Template
        </Button>
      </div>

      {/* Day tabs */}
      <Card padding="none">
        <div className="flex border-b border-gray-200">
          {DAY_NAMES.map((day, index) => (
            <button
              key={day}
              onClick={() => setSelectedDay(index)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                selectedDay === index
                  ? 'border-b-2 border-primary-500 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        <div className="p-6">
          <div className="py-12 text-center">
            <p className="text-gray-500">
              Templates for {DAY_NAMES[selectedDay]} will be shown here.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Template management will be implemented in Sprint 3.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
