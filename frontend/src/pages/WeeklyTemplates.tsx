import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, Clock, Droplet, Truck } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Select } from '../components/common/Select'
import { Badge } from '../components/common/Badge'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import {
  useTemplatesByDay,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '../hooks/useSchedules'
import { useCustomers } from '../hooks/useCustomers'
import { useTankers } from '../hooks/useTankers'
import { useFuelBlendOptions } from '../hooks/useReference'
import { toast } from '../store/toastStore'
import { WeeklyTemplate } from '../types/api'
import { DAY_NAMES } from '../utils/constants'
import { formatTime, formatVolume } from '../utils/formatters'
import { useAuth } from '../hooks/useAuth'

// Form validation schema
const templateSchema = z.object({
  customer_id: z.coerce.number().min(1, 'Customer is required'),
  day_of_week: z.coerce.number().min(0).max(6),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  tanker_id: z.coerce.number().nullable().optional(),
  fuel_blend_id: z.coerce.number().nullable().optional(),
  volume: z.coerce.number().min(1, 'Volume must be at least 1'),
  is_mobile_op: z.boolean().default(false),
  needs_return: z.boolean().default(false),
  priority: z.coerce.number().default(0),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
})

type TemplateFormData = z.infer<typeof templateSchema>

export function WeeklyTemplates() {
  const { canEdit } = useAuth()
  const [selectedDay, setSelectedDay] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WeeklyTemplate | null>(null)

  // Queries
  const { data: templates, isLoading } = useTemplatesByDay(selectedDay)
  const { data: customersData } = useCustomers({ is_active: true, per_page: 100 })
  const { data: tankersData } = useTankers({ is_active: true, per_page: 100 })
  const { options: fuelBlendOptions } = useFuelBlendOptions()

  // Mutations
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()
  const deleteMutation = useDeleteTemplate()

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

  // Tanker options
  const tankerOptions = useMemo(() => {
    return [
      { value: 0, label: 'No tanker assigned' },
      ...(tankersData?.items || []).map((t) => ({
        value: t.id,
        label: `${t.name} (${t.max_capacity}L)`,
      })),
    ]
  }, [tankersData])

  // Fuel blend select options
  const fuelBlendSelectOptions = [
    { value: 0, label: 'Default (customer)' },
    ...fuelBlendOptions,
  ]

  // Form
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      customer_id: 0,
      day_of_week: selectedDay,
      start_time: '08:00',
      end_time: '09:00',
      tanker_id: null,
      fuel_blend_id: null,
      volume: 5000,
      is_mobile_op: false,
      needs_return: false,
      priority: 0,
      notes: null,
      is_active: true,
    },
  })

  // Handlers
  const handleAdd = () => {
    setSelectedTemplate(null)
    reset({
      customer_id: 0,
      day_of_week: selectedDay,
      start_time: '08:00',
      end_time: '09:00',
      tanker_id: null,
      fuel_blend_id: null,
      volume: 5000,
      is_mobile_op: false,
      needs_return: false,
      priority: 0,
      notes: null,
      is_active: true,
    })
    setModalOpen(true)
  }

  const handleEdit = (template: WeeklyTemplate) => {
    setSelectedTemplate(template)
    reset({
      customer_id: template.customer.id,
      day_of_week: template.day_of_week,
      start_time: template.start_time,
      end_time: template.end_time,
      tanker_id: template.tanker?.id || null,
      fuel_blend_id: template.fuel_blend?.id || null,
      volume: template.volume,
      is_mobile_op: template.is_mobile_op,
      needs_return: template.needs_return,
      priority: template.priority,
      notes: template.notes,
      is_active: template.is_active,
    })
    setModalOpen(true)
  }

  const handleDeleteClick = (template: WeeklyTemplate) => {
    setSelectedTemplate(template)
    setDeleteDialogOpen(true)
  }

  const onSubmit = async (data: TemplateFormData) => {
    try {
      const payload = {
        ...data,
        tanker_id: data.tanker_id === 0 ? null : data.tanker_id,
        fuel_blend_id: data.fuel_blend_id === 0 ? null : data.fuel_blend_id,
      }
      if (selectedTemplate) {
        await updateMutation.mutateAsync({ id: selectedTemplate.id, ...payload })
        toast.success('Template updated successfully')
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Template created successfully')
      }
      setModalOpen(false)
    } catch (error) {
      toast.error('Failed to save template')
    }
  }

  const handleDelete = async () => {
    if (!selectedTemplate) return
    try {
      await deleteMutation.mutateAsync(selectedTemplate.id)
      toast.success('Template deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedTemplate(null)
    } catch (error) {
      toast.error('Failed to delete template')
    }
  }

  // Sort templates by start time
  const sortedTemplates = useMemo(() => {
    if (!templates) return []
    return [...templates].sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [templates])

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
        {canEdit && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
        )}
      </div>

      {/* Day tabs */}
      <Card padding="none">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {DAY_NAMES.map((day, index) => (
            <button
              key={day}
              onClick={() => setSelectedDay(index)}
              className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium transition-colors ${
                selectedDay === index
                  ? 'border-b-2 border-primary-500 text-primary-600 bg-primary-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : sortedTemplates.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">
                No templates for {DAY_NAMES[selectedDay]}.
              </p>
              {canEdit && (
                <Button className="mt-4" onClick={handleAdd}>
                  <Plus className="h-4 w-4" />
                  Add First Template
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`rounded-lg border p-4 ${
                    template.is_active
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-gray-900">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">
                            {formatTime(template.start_time)} - {formatTime(template.end_time)}
                          </span>
                        </div>
                        {template.is_mobile_op && (
                          <Badge variant="warning" className="text-xs">Mobile Op</Badge>
                        )}
                        {template.needs_return && (
                          <Badge variant="info" className="text-xs">Return</Badge>
                        )}
                        {!template.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>

                      <div className="mt-2 text-lg font-semibold text-gray-900">
                        {template.customer.code} - {template.customer.name}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Droplet className="h-4 w-4 text-blue-500" />
                          <span>{formatVolume(template.volume)}</span>
                          {template.fuel_blend && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {template.fuel_blend.code}
                            </Badge>
                          )}
                        </div>
                        {template.tanker && (
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-4 w-4 text-primary-500" />
                            <span>{template.tanker.name}</span>
                          </div>
                        )}
                      </div>

                      {template.notes && (
                        <p className="mt-2 text-sm text-gray-500">{template.notes}</p>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(template)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedTemplate ? 'Edit Template' : 'Add Template'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <Controller
              name="customer_id"
              control={control}
              render={({ field }) => (
                <Select
                  label="Customer"
                  required
                  options={customerOptions}
                  value={field.value}
                  onChange={(val) => field.onChange(Number(val))}
                  error={errors.customer_id?.message}
                />
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <Select
                label="Day of Week"
                required
                options={DAY_NAMES.map((day, index) => ({
                  value: index,
                  label: day,
                }))}
                {...register('day_of_week')}
                error={errors.day_of_week?.message}
              />
              <Input
                label="Start Time"
                type="time"
                required
                {...register('start_time')}
                error={errors.start_time?.message}
              />
              <Input
                label="End Time"
                type="time"
                required
                {...register('end_time')}
                error={errors.end_time?.message}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Volume (L)"
                type="number"
                required
                {...register('volume')}
                error={errors.volume?.message}
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

            <Controller
              name="tanker_id"
              control={control}
              render={({ field }) => (
                <Select
                  label="Default Tanker"
                  options={tankerOptions}
                  value={field.value || 0}
                  onChange={(val) => field.onChange(Number(val))}
                  error={errors.tanker_id?.message}
                />
              )}
            />

            <Input
              label="Priority"
              type="number"
              helperText="Higher numbers = higher priority"
              {...register('priority')}
              error={errors.priority?.message}
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
                  {...register('is_mobile_op')}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Mobile Operation</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('needs_return')}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Needs Return Trip</span>
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
              {selectedTemplate ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Template"
        message={`Are you sure you want to delete the template for "${selectedTemplate?.customer.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
