import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, Layers, Calendar, Clock } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Badge } from '../components/common/Badge'
import { Table } from '../components/common/Table'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import {
  useTripGroups,
  useCreateTripGroup,
  useUpdateTripGroup,
  useDeleteTripGroup,
  useTripGroup,
  useAddTemplatesToGroup,
  useRemoveTemplateFromGroup,
} from '../hooks/useTripGroups'
import { useAllTemplates } from '../hooks/useSchedules'
import { toast } from '../store/toastStore'
import { TripGroupListItem } from '../types/api'
import { useAuth } from '../hooks/useAuth'

// Form validation schema
const tripGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().nullable().optional(),
})

type TripGroupFormData = z.infer<typeof tripGroupSchema>

// Day names
const DAY_NAMES = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function TripGroups() {
  const { canEdit } = useAuth()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<TripGroupListItem | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  // Queries and mutations
  const { data, isLoading } = useTripGroups({ search: search || undefined })
  const { data: groupDetail } = useTripGroup(selectedGroupId || 0)
  const { data: allTemplates } = useAllTemplates()
  const createMutation = useCreateTripGroup()
  const updateMutation = useUpdateTripGroup()
  const deleteMutation = useDeleteTripGroup()
  const addTemplatesMutation = useAddTemplatesToGroup()
  const removeTemplateMutation = useRemoveTemplateFromGroup()

  // Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TripGroupFormData>({
    resolver: zodResolver(tripGroupSchema),
    defaultValues: {
      name: '',
      description: null,
    },
  })

  // Group templates by day for display
  const templatesByDay = useMemo(() => {
    if (!groupDetail?.templates) return {}
    const grouped: Record<number, typeof groupDetail.templates> = {}
    groupDetail.templates.forEach((t) => {
      if (!grouped[t.day_of_week]) grouped[t.day_of_week] = []
      grouped[t.day_of_week].push(t)
    })
    // Sort by start time within each day
    Object.keys(grouped).forEach((day) => {
      grouped[Number(day)].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
    return grouped
  }, [groupDetail])

  // Available templates (not in current group)
  const availableTemplates = useMemo(() => {
    if (!allTemplates || !groupDetail) return []
    const assignedIds = new Set(groupDetail.templates.map((t) => t.id))
    return allTemplates.filter((t) => !assignedIds.has(t.id) && t.is_active)
  }, [allTemplates, groupDetail])

  // Table columns
  const columns: ColumnDef<TripGroupListItem>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Trip Group',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{row.original.name}</div>
              {row.original.description && (
                <div className="text-xs text-gray-500 line-clamp-1">
                  {row.original.description}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'template_count',
        header: 'Templates',
        cell: ({ row }) => (
          <Badge variant="info">{row.original.template_count} templates</Badge>
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
              cell: ({ row }: { row: { original: TripGroupListItem } }) => (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleManageTemplates(row.original)
                    }}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
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
    setSelectedGroup(null)
    reset({
      name: '',
      description: null,
    })
    setModalOpen(true)
  }

  const handleEdit = (group: TripGroupListItem) => {
    setSelectedGroup(group)
    reset({
      name: group.name,
      description: group.description,
    })
    setModalOpen(true)
  }

  const handleManageTemplates = (group: TripGroupListItem) => {
    setSelectedGroup(group)
    setSelectedGroupId(group.id)
    setTemplatesModalOpen(true)
  }

  const handleDeleteClick = (group: TripGroupListItem) => {
    setSelectedGroup(group)
    setDeleteDialogOpen(true)
  }

  const onSubmit = async (data: TripGroupFormData) => {
    try {
      if (selectedGroup) {
        await updateMutation.mutateAsync({ id: selectedGroup.id, ...data })
        toast.success('Trip group updated successfully')
      } else {
        await createMutation.mutateAsync(data)
        toast.success('Trip group created successfully')
      }
      setModalOpen(false)
    } catch (error) {
      toast.error('Failed to save trip group')
    }
  }

  const handleDelete = async () => {
    if (!selectedGroup) return
    try {
      await deleteMutation.mutateAsync(selectedGroup.id)
      toast.success('Trip group deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedGroup(null)
    } catch (error) {
      toast.error('Failed to delete trip group')
    }
  }

  const handleAddTemplate = async (templateId: number) => {
    if (!selectedGroupId) return
    try {
      await addTemplatesMutation.mutateAsync({
        id: selectedGroupId,
        template_ids: [templateId],
      })
      toast.success('Template added to group')
    } catch (error) {
      toast.error('Failed to add template')
    }
  }

  const handleRemoveTemplate = async (templateId: number) => {
    if (!selectedGroupId) return
    try {
      await removeTemplateMutation.mutateAsync({
        groupId: selectedGroupId,
        templateId,
      })
      toast.success('Template removed from group')
    } catch (error) {
      toast.error('Failed to remove template')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trip Groups</h1>
          <p className="mt-1 text-sm text-gray-500">
            Group weekly templates for driver assignment
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add Trip Group
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search trip groups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <Table
          data={data?.items || []}
          columns={columns}
          isLoading={isLoading}
          searchColumn="name"
          searchValue={search}
          emptyMessage="No trip groups found"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedGroup ? 'Edit Trip Group' : 'Add Trip Group'}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <Input
              label="Name"
              required
              {...register('name')}
              error={errors.name?.message}
              placeholder="e.g., Route A, Morning Shift"
            />
            <Input
              label="Description"
              {...register('description')}
              error={errors.description?.message}
              placeholder="Optional description"
            />
          </div>

          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {selectedGroup ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Manage Templates Modal */}
      <Modal
        isOpen={templatesModalOpen}
        onClose={() => {
          setTemplatesModalOpen(false)
          setSelectedGroupId(null)
        }}
        title={`Manage Templates - ${selectedGroup?.name}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Current templates by day */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Current Templates ({groupDetail?.template_count || 0})
            </h3>
            {Object.keys(templatesByDay).length === 0 ? (
              <p className="text-sm text-gray-500 italic">No templates assigned</p>
            ) : (
              <div className="grid gap-4">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const dayTemplates = templatesByDay[day]
                  if (!dayTemplates?.length) return null
                  return (
                    <div key={day} className="border rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {DAY_NAMES[day]}
                      </div>
                      <div className="space-y-2">
                        {dayTemplates.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between bg-gray-50 rounded p-2"
                          >
                            <div className="flex items-center gap-3">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {t.start_time.slice(0, 5)} - {t.end_time.slice(0, 5)}
                              </span>
                              <span className="text-sm font-medium">
                                {t.customer.code}
                              </span>
                              <span className="text-sm text-gray-500">
                                {t.volume.toLocaleString()} L
                              </span>
                            </div>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTemplate(t.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Available templates */}
          {canEdit && availableTemplates.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Available Templates ({availableTemplates.length})
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {availableTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between bg-gray-50 rounded p-2"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">
                        {DAY_NAMES[t.day_of_week]}
                      </Badge>
                      <span className="text-sm">
                        {t.start_time.slice(0, 5)} - {t.end_time.slice(0, 5)}
                      </span>
                      <span className="text-sm font-medium">
                        {t.customer.code}
                      </span>
                      <span className="text-sm text-gray-500">
                        {t.volume.toLocaleString()} L
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAddTemplate(t.id)}
                      disabled={addTemplatesMutation.isPending}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setTemplatesModalOpen(false)
              setSelectedGroupId(null)
            }}
          >
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Trip Group"
        message={`Are you sure you want to delete "${selectedGroup?.name}"? This will also remove all weekly driver assignments for this group.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
