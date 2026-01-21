import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, Filter } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Select } from '../components/common/Select'
import { Badge } from '../components/common/Badge'
import { Table } from '../components/common/Table'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver } from '../hooks/useDrivers'
import { toast } from '../store/toastStore'
import { Driver, DriverType } from '../types/api'
import { formatDate } from '../utils/formatters'
import { useAuth } from '../hooks/useAuth'

// Form validation schema
const driverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  employee_id: z.string().nullable().optional(),
  driver_type: z.enum(['internal', '3pl']),
  contact_phone: z.string().nullable().optional(),
  license_number: z.string().nullable().optional(),
  license_expiry: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
})

type DriverFormData = z.infer<typeof driverSchema>

export function Drivers() {
  const { canEdit } = useAuth()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DriverType | ''>('')
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)

  // Query params
  const queryParams = {
    search: search || undefined,
    driver_type: typeFilter || undefined,
    is_active: activeFilter === '' ? undefined : activeFilter === 'true',
    per_page: 20,
  }

  // Queries and mutations
  const { data, isLoading } = useDrivers(queryParams)
  const createMutation = useCreateDriver()
  const updateMutation = useUpdateDriver()
  const deleteMutation = useDeleteDriver()

  // Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: '',
      employee_id: null,
      driver_type: 'internal',
      contact_phone: null,
      license_number: null,
      license_expiry: null,
      notes: null,
      is_active: true,
    },
  })

  // Table columns
  const columns: ColumnDef<Driver>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-gray-900">{row.original.name}</div>
            {row.original.employee_id && (
              <div className="text-xs text-gray-500">ID: {row.original.employee_id}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'driver_type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.driver_type === 'internal' ? 'info' : 'warning'}>
            {row.original.driver_type === 'internal' ? 'Internal' : '3PL'}
          </Badge>
        ),
      },
      {
        accessorKey: 'contact_phone',
        header: 'Phone',
        cell: ({ row }) => row.original.contact_phone || '-',
      },
      {
        accessorKey: 'license_expiry',
        header: 'License Expiry',
        cell: ({ row }) => formatDate(row.original.license_expiry),
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'success' : 'secondary'}>
            {row.original.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }: { row: { original: Driver } }) => (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(row.original)
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick(row.original)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canEdit]
  )

  // Handlers
  const handleAdd = () => {
    setSelectedDriver(null)
    reset({
      name: '',
      employee_id: null,
      driver_type: 'internal',
      contact_phone: null,
      license_number: null,
      license_expiry: null,
      notes: null,
      is_active: true,
    })
    setModalOpen(true)
  }

  const handleEdit = (driver: Driver) => {
    setSelectedDriver(driver)
    reset({
      name: driver.name,
      employee_id: driver.employee_id,
      driver_type: driver.driver_type,
      contact_phone: driver.contact_phone,
      license_number: driver.license_number,
      license_expiry: driver.license_expiry,
      notes: driver.notes,
      is_active: driver.is_active,
    })
    setModalOpen(true)
  }

  const handleDeleteClick = (driver: Driver) => {
    setSelectedDriver(driver)
    setDeleteDialogOpen(true)
  }

  const onSubmit = async (data: DriverFormData) => {
    try {
      if (selectedDriver) {
        await updateMutation.mutateAsync({ id: selectedDriver.id, ...data })
        toast.success('Driver updated successfully')
      } else {
        await createMutation.mutateAsync(data)
        toast.success('Driver created successfully')
      }
      setModalOpen(false)
    } catch (error) {
      toast.error('Failed to save driver')
    }
  }

  const handleDelete = async () => {
    if (!selectedDriver) return
    try {
      await deleteMutation.mutateAsync(selectedDriver.id)
      toast.success('Driver deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedDriver(null)
    } catch (error) {
      toast.error('Failed to delete driver')
    }
  }

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
        {canEdit && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add Driver
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
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
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
            <Select
              label="Type"
              options={[
                { value: '', label: 'All Types' },
                { value: 'internal', label: 'Internal' },
                { value: '3pl', label: '3PL' },
              ]}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as DriverType | '')}
            />
            <Select
              label="Status"
              options={[
                { value: '', label: 'All Status' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={activeFilter}
              onChange={(value) => setActiveFilter(value)}
            />
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setTypeFilter('')
                  setActiveFilter('')
                  setSearch('')
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card padding="none">
        <Table
          data={data?.items || []}
          columns={columns}
          isLoading={isLoading}
          searchColumn="name"
          searchValue={search}
          emptyMessage="No drivers found"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedDriver ? 'Edit Driver' : 'Add Driver'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <Input
              label="Name"
              required
              {...register('name')}
              error={errors.name?.message}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Employee ID"
                {...register('employee_id')}
                error={errors.employee_id?.message}
              />
              <Select
                label="Type"
                required
                options={[
                  { value: 'internal', label: 'Internal' },
                  { value: '3pl', label: '3PL' },
                ]}
                {...register('driver_type')}
                error={errors.driver_type?.message}
              />
            </div>

            <Input
              label="Phone"
              type="tel"
              {...register('contact_phone')}
              error={errors.contact_phone?.message}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="License Number"
                {...register('license_number')}
                error={errors.license_number?.message}
              />
              <Input
                label="License Expiry"
                type="date"
                {...register('license_expiry')}
                error={errors.license_expiry?.message}
              />
            </div>

            <Input
              label="Notes"
              {...register('notes')}
              error={errors.notes?.message}
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('is_active')}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {selectedDriver ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Driver"
        message={`Are you sure you want to delete "${selectedDriver?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
