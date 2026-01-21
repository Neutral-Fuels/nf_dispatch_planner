import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, Filter, Building2, MapPin } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Select } from '../components/common/Select'
import { Textarea } from '../components/common/Textarea'
import { Badge } from '../components/common/Badge'
import { Table } from '../components/common/Table'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../hooks/useCustomers'
import { useEmirateOptions, useFuelBlendOptions } from '../hooks/useReference'
import { toast } from '../store/toastStore'
import { Customer, CustomerType } from '../types/api'
import { formatVolume } from '../utils/formatters'
import { useAuth } from '../hooks/useAuth'

// Form validation schema
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Customer code is required'),
  customer_type: z.enum(['bulk', 'mobile']),
  fuel_blend_id: z.number().nullable().optional(),
  estimated_volume: z.coerce.number().nullable().optional(),
  emirate_id: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  contact_email: z.string().email('Invalid email').nullable().optional().or(z.literal('')),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
})

type CustomerFormData = z.infer<typeof customerSchema>

export function Customers() {
  const { canEdit } = useAuth()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<CustomerType | ''>('')
  const [emirateFilter, setEmirateFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Query params
  const queryParams = {
    search: search || undefined,
    customer_type: typeFilter || undefined,
    emirate_id: emirateFilter ? Number(emirateFilter) : undefined,
    per_page: 20,
  }

  // Queries and mutations
  const { data, isLoading } = useCustomers(queryParams)
  const { options: emirateOptions } = useEmirateOptions()
  const { options: fuelBlendOptions } = useFuelBlendOptions()
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const deleteMutation = useDeleteCustomer()

  // Form
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      code: '',
      customer_type: 'bulk',
      fuel_blend_id: null,
      estimated_volume: null,
      emirate_id: null,
      address: null,
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      notes: null,
      is_active: true,
    },
  })

  // Table columns
  const columns: ColumnDef<Customer>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{row.original.name}</div>
              <div className="text-xs text-gray-500">{row.original.code}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'customer_type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.customer_type === 'bulk' ? 'info' : 'warning'}>
            {row.original.customer_type === 'bulk' ? 'Bulk' : 'Mobile'}
          </Badge>
        ),
      },
      {
        accessorKey: 'fuel_blend',
        header: 'Fuel Blend',
        cell: ({ row }) => row.original.fuel_blend?.code || '-',
      },
      {
        accessorKey: 'estimated_volume',
        header: 'Est. Volume',
        cell: ({ row }) => formatVolume(row.original.estimated_volume),
      },
      {
        accessorKey: 'emirate',
        header: 'Location',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {row.original.emirate && (
              <>
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{row.original.emirate.name}</span>
              </>
            )}
            {!row.original.emirate && '-'}
          </div>
        ),
      },
      {
        accessorKey: 'contact_name',
        header: 'Contact',
        cell: ({ row }) => (
          <div>
            <div className="text-sm">{row.original.contact_name || '-'}</div>
            {row.original.contact_phone && (
              <div className="text-xs text-gray-500">{row.original.contact_phone}</div>
            )}
          </div>
        ),
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
              cell: ({ row }: { row: { original: Customer } }) => (
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
    setSelectedCustomer(null)
    reset({
      name: '',
      code: '',
      customer_type: 'bulk',
      fuel_blend_id: null,
      estimated_volume: null,
      emirate_id: null,
      address: null,
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      notes: null,
      is_active: true,
    })
    setModalOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer)
    reset({
      name: customer.name,
      code: customer.code,
      customer_type: customer.customer_type,
      fuel_blend_id: customer.fuel_blend?.id || null,
      estimated_volume: customer.estimated_volume,
      emirate_id: customer.emirate?.id || null,
      address: customer.address,
      contact_name: customer.contact_name,
      contact_phone: customer.contact_phone,
      contact_email: customer.contact_email || '',
      notes: customer.notes,
      is_active: customer.is_active,
    })
    setModalOpen(true)
  }

  const handleDeleteClick = (customer: Customer) => {
    setSelectedCustomer(customer)
    setDeleteDialogOpen(true)
  }

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const payload = {
        ...data,
        fuel_blend_id: data.fuel_blend_id === 0 ? null : data.fuel_blend_id,
        emirate_id: data.emirate_id === 0 ? null : data.emirate_id,
        contact_email: data.contact_email || null,
      }
      if (selectedCustomer) {
        await updateMutation.mutateAsync({ id: selectedCustomer.id, ...payload })
        toast.success('Customer updated successfully')
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Customer created successfully')
      }
      setModalOpen(false)
    } catch (error) {
      toast.error('Failed to save customer')
    }
  }

  const handleDelete = async () => {
    if (!selectedCustomer) return
    try {
      await deleteMutation.mutateAsync(selectedCustomer.id)
      toast.success('Customer deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedCustomer(null)
    } catch (error) {
      toast.error('Failed to delete customer')
    }
  }

  // Options with empty first option
  const emirateSelectOptions = [
    { value: 0, label: 'Select emirate...' },
    ...emirateOptions,
  ]
  const fuelBlendSelectOptions = [
    { value: 0, label: 'Select fuel blend...' },
    ...fuelBlendOptions,
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage customer information and delivery requirements
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add Customer
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
                placeholder="Search customers..."
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
              label="Customer Type"
              options={[
                { value: '', label: 'All Types' },
                { value: 'bulk', label: 'Bulk' },
                { value: 'mobile', label: 'Mobile' },
              ]}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as CustomerType | '')}
            />
            <Select
              label="Emirate"
              options={[
                { value: '', label: 'All Emirates' },
                ...emirateOptions.map((e) => ({ value: String(e.value), label: e.label })),
              ]}
              value={emirateFilter}
              onChange={(value) => setEmirateFilter(value)}
            />
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setTypeFilter('')
                  setEmirateFilter('')
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
          emptyMessage="No customers found"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedCustomer ? 'Edit Customer' : 'Add Customer'}
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
                label="Customer Code"
                required
                {...register('code')}
                error={errors.code?.message}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Customer Type"
                required
                options={[
                  { value: 'bulk', label: 'Bulk' },
                  { value: 'mobile', label: 'Mobile' },
                ]}
                {...register('customer_type')}
                error={errors.customer_type?.message}
              />
              <Controller
                name="fuel_blend_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Fuel Blend"
                    options={fuelBlendSelectOptions}
                    value={field.value || 0}
                    onChange={(val) => field.onChange(Number(val))}
                    error={errors.fuel_blend_id?.message}
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Estimated Volume (L)"
                type="number"
                {...register('estimated_volume')}
                error={errors.estimated_volume?.message}
              />
              <Controller
                name="emirate_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Emirate"
                    options={emirateSelectOptions}
                    value={field.value || 0}
                    onChange={(val) => field.onChange(Number(val))}
                    error={errors.emirate_id?.message}
                  />
                )}
              />
            </div>

            <Textarea
              label="Address"
              {...register('address')}
              error={errors.address?.message}
            />

            <div className="border-t pt-4">
              <h4 className="mb-3 text-sm font-medium text-gray-700">Contact Information</h4>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Contact Name"
                  {...register('contact_name')}
                  error={errors.contact_name?.message}
                />
                <Input
                  label="Phone"
                  type="tel"
                  {...register('contact_phone')}
                  error={errors.contact_phone?.message}
                />
                <Input
                  label="Email"
                  type="email"
                  {...register('contact_email')}
                  error={errors.contact_email?.message}
                />
              </div>
            </div>

            <Textarea
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
              {selectedCustomer ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${selectedCustomer?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
