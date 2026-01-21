import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Badge } from '../components/common/Badge'

// Placeholder page - will be expanded in Sprint 2
export function Drivers() {
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage driver information and schedules
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Add Driver
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search drivers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Placeholder content */}
      <Card>
        <div className="py-12 text-center">
          <p className="text-gray-500">
            Driver management will be implemented in Sprint 2.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Full CRUD operations with schedule grid coming soon.
          </p>
        </div>
      </Card>
    </div>
  )
}
