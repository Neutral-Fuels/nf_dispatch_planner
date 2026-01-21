import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, Filter, Truck } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Select } from '../components/common/Select'
import { MultiSelect } from '../components/common/MultiSelect'
import { Badge } from '../components/common/Badge'
import { Table } from '../components/common/Table'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useTankers, useCreateTanker, useUpdateTanker, useDeleteTanker } from '../hooks/useTankers'
import { useDrivers } from '../hooks/useDrivers'
import { useEmirateOptions, useFuelBlendOptions } from '../hooks/useReference'
import { toast } from '../store/toastStore'
import { Tanker, DeliveryType, TankerStatus } from '../types/api'
import { formatVolume } from '../utils/formatters'
import { useAuth } from '../hooks/useAuth'

// Form validation schema
const tankerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  registration: z.string().nullable().optional(),
  max_capacity: z.coerce.number().min(1, 'Capacity must be at least 1'),
  delivery_type: z.enum(['bulk', 'mobile', 'both']),
  status: z.enum(['active', 'maintenance', 'inactive']).default('active'),
  is_3pl: z.boolean().default(false),
  fuel_blend_ids: z.array(z.number()).min(1, 'Select at least one fuel blend'),
  emirate_ids: z.array(z.number()).min(1, 'Select at least one emirate'),
  default_driver_id: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
})

type TankerFormData = z.infer<typeof tankerSchema>

export function Tankers() {
  const { canEdit } = useAuth()
  const [search, setSearch] = useState('')
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<DeliveryType | ''>('')
  const [statusFilter, setStatusFilter] = useState<TankerStatus | ''>('')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTanker, setSelectedTanker] = useState<Tanker | null>(null)

  // Query params
  const queryParams = {
    search: search || undefined,
    delivery_type: deliveryTypeFilter || undefined,
    status: statusFilter || undefined,
    per_page: 20,
  }

  // Queries and mutations
  const { data, isLoading } = useTankers(queryParams)
  const { data: driversData } = useDrivers({ is_active: true, per_page: 100 })
  const { options: emirateOptions } = useEmirateOptions()
  const { options: fuelBlendOptions } = useFuelBlendOptions()
  const createMutation = useCreateTanker()
  const updateMutation = useUpdateTanker()
  const deleteMutation = useDeleteTanker()

  // Driver options for select
  const driverOptions = useMemo(() => {
    return [
      { value: 0, label: 'No default driver' },
      ...(driversData?.items || []).map((d) => ({
        value: d.id,
        label: d.name,
      })),
    ]
  }, [driversData])

  // Form
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TankerFormData>({
    resolver: zodResolver(tankerSchema),
    defaultValues: {
      name: '',
      registration: null,
      max_capacity: 10000,
      delivery_type: 'bulk',
      status: 'active',
      is_3pl: false,
      fuel_blend_ids: [],
      emirate_ids: [],
      default_driver_id: null,
      notes: null,
      is_active: true,
    },
  })

  // Status badge variants
  const statusVariants: Record<TankerStatus, 'success' | 'warning' | 'secondary'> = {
    active: 'success',
    maintenance: 'warning',
    inactive: 'secondary',
  }

  // Table columns
  const columns: ColumnDef<Tanker>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Tanker',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{row.original.name}</div>
              {row.original.registration && (
                <div className="text-xs text-gray-500">{row.original.registration}</div>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'max_capacity',
        header: 'Capacity',
        cell: ({ row }) => formatVolume(row.original.max_capacity),
      },
      {
        accessorKey: 'delivery_type',
        header: 'Delivery',
        cell: ({ row }) => {
          const types = {
            bulk: 'Bulk',
            mobile: 'Mobile',
            both: 'Both',
          }
          return (
            <Badge variant="info">
              {types[row.original.delivery_type]}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'fuel_blends',
        header: 'Fuel Blends',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.fuel_blends.slice(0, 3).map((blend) => (
              <Badge key={blend.id} variant="secondary" className="text-xs">
                {blend.code}
              </Badge>
            ))}
            {row.original.fuel_blends.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{row.original.fuel_blends.length - 3}
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'emirates',
        header: 'Emirates',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.emirates.slice(0, 3).map((emirate) => (
              <Badge key={emirate.id} variant="secondary" className="text-xs">
                {emirate.code}
              </Badge>
            ))}
            {row.original.emirates.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{row.original.emirates.length - 3}
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={statusVariants[row.original.status]}>
            {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
          </Badge>
        ),
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }: { row: { original: Tanker } }) => (
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
    setSelectedTanker(null)
    reset({
      name: '',
      registration: null,
      max_capacity: 10000,
      delivery_type: 'bulk',
      status: 'active',
      is_3pl: false,
      fuel_blend_ids: [],
      emirate_ids: [],
      default_driver_id: null,
      notes: null,
      is_active: true,
    })
    setModalOpen(true)
  }

  const handleEdit = (tanker: Tanker) => {
    setSelectedTanker(tanker)
    reset({
      name: tanker.name,
      registration: tanker.registration,
      max_capacity: tanker.max_capacity,
      delivery_type: tanker.delivery_type,
      status: tanker.status,
      is_3pl: tanker.is_3pl,
      fuel_blend_ids: tanker.fuel_blends.map((b) => b.id),
      emirate_ids: tanker.emirates.map((e) => e.id),
      default_driver_id: tanker.default_driver?.id || null,
      notes: tanker.notes,
      is_active: tanker.is_active,
    })
    setModalOpen(true)
  }

  const handleDeleteClick = (tanker: Tanker) => {
    setSelectedTanker(tanker)
    setDeleteDialogOpen(true)
  }

  const onSubmit = async (data: TankerFormData) => {
    try {
      const payload = {
        ...data,
        default_driver_id: data.default_driver_id === 0 ? null : data.default_driver_id,
      }
      if (selectedTanker) {
        await updateMutation.mutateAsync({ id: selectedTanker.id, ...payload })
        toast.success('Tanker updated successfully')
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Tanker created successfully')
      }
      setModalOpen(false)
    } catch (error) {
      toast.error('Failed to save tanker')
    }
  }

  const handleDelete = async () => {
    if (!selectedTanker) return
    try {
      await deleteMutation.mutateAsync(selectedTanker.id)
      toast.success('Tanker deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedTanker(null)
    } catch (error) {
      toast.error('Failed to delete tanker')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tanker Fleet</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage tankers, capacities, and coverage
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add Tanker
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
                placeholder="Search tankers..."
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
              label="Delivery Type"
              options={[
                { value: '', label: 'All Types' },
                { value: 'bulk', label: 'Bulk' },
                { value: 'mobile', label: 'Mobile' },
                { value: 'both', label: 'Both' },
              ]}
              value={deliveryTypeFilter}
              onChange={(e) => setDeliveryTypeFilter(e.target.value as DeliveryType | '')}
            />
            <Select
              label="Status"
              options={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'maintenance', label: 'Maintenance' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TankerStatus | '')}
            />
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeliveryTypeFilter('')
                  setStatusFilter('')
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
          emptyMessage="No tankers found"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedTanker ? 'Edit Tanker' : 'Add Tanker'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Name"
                required
                {...register('name')}
                error={errors.name?.message}
              />
              <Input
                label="Registration"
                {...register('registration')}
                error={errors.registration?.message}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Max Capacity (L)"
                type="number"
                required
                {...register('max_capacity')}
                error={errors.max_capacity?.message}
              />
              <Select
                label="Delivery Type"
                required
                options={[
                  { value: 'bulk', label: 'Bulk' },
                  { value: 'mobile', label: 'Mobile' },
                  { value: 'both', label: 'Both' },
                ]}
                {...register('delivery_type')}
                error={errors.delivery_type?.message}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Status"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'maintenance', label: 'Maintenance' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                {...register('status')}
                error={errors.status?.message}
              />
              <Controller
                name="default_driver_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Default Driver"
                    options={driverOptions}
                    value={field.value || 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    error={errors.default_driver_id?.message}
                  />
                )}
              />
            </div>

            <Controller
              name="fuel_blend_ids"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  label="Fuel Blends"
                  required
                  options={fuelBlendOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.fuel_blend_ids?.message}
                  placeholder="Select fuel blends..."
                />
              )}
            />

            <Controller
              name="emirate_ids"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  label="Emirates Coverage"
                  required
                  options={emirateOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.emirate_ids?.message}
                  placeholder="Select emirates..."
                />
              )}
            />

            <Input
              label="Notes"
              {...register('notes')}
              error={errors.notes?.message}
            />

            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('is_3pl')}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">3PL Tanker</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('is_active')}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {selectedTanker ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Tanker"
        message={`Are you sure you want to delete "${selectedTanker?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
