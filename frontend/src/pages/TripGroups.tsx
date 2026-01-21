import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, Layers, Clock, ArrowRight, X } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Badge } from '../components/common/Badge'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { Loader } from '../components/common/Loader'
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

// Day names for UAE week (Saturday - Friday)
const DAYS = [
  { value: 0, label: 'Saturday', short: 'Sat' },
  { value: 1, label: 'Sunday', short: 'Sun' },
  { value: 2, label: 'Monday', short: 'Mon' },
  { value: 3, label: 'Tuesday', short: 'Tue' },
  { value: 4, label: 'Wednesday', short: 'Wed' },
  { value: 5, label: 'Thursday', short: 'Thu' },
  { value: 6, label: 'Friday', short: 'Fri' },
]

// Form validation schema
const tripGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().nullable().optional(),
})

type TripGroupFormData = z.infer<typeof tripGroupSchema>

export function TripGroups() {
  const { canEdit } = useAuth()
  const [selectedDay, setSelectedDay] = useState(0) // Start with Saturday
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<TripGroupListItem | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null)

  // Queries and mutations
  const { data: groupsData, isLoading: groupsLoading } = useTripGroups({
    day_of_week: selectedDay,
    search: search || undefined,
  })
  const { data: groupDetail } = useTripGroup(selectedGroupId || 0)
  const { data: allTemplates, isLoading: templatesLoading } = useAllTemplates()
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

  // Get templates for the selected day
  const dayTemplates = useMemo(() => {
    if (!allTemplates) return []
    // Debug logging
    console.log('All templates:', allTemplates)
    console.log('Selected day:', selectedDay, typeof selectedDay)
    if (allTemplates.length > 0) {
      console.log('First template day_of_week:', allTemplates[0].day_of_week, typeof allTemplates[0].day_of_week)
      console.log('First template is_active:', allTemplates[0].is_active, typeof allTemplates[0].is_active)
    }
    const filtered = allTemplates.filter((t) => t.day_of_week === selectedDay && t.is_active)
    console.log('Filtered templates for day', selectedDay, ':', filtered)
    return filtered
  }, [allTemplates, selectedDay])

  // Available templates (not assigned to any group on this day)
  const availableTemplates = useMemo(() => {
    // For a proper implementation, we'd need to track all assigned templates
    // For now, show templates not in the currently expanded group
    if (!expandedGroupId || !groupDetail) {
      return dayTemplates
    }
    const assignedIds = new Set(groupDetail.templates.map((t) => t.id))
    return dayTemplates.filter((t) => !assignedIds.has(t.id))
  }, [dayTemplates, expandedGroupId, groupDetail])

  // Handlers
  const handleDayChange = (day: number) => {
    setSelectedDay(day)
    setExpandedGroupId(null)
    setSelectedGroupId(null)
  }

  const handleAddGroup = () => {
    setSelectedGroup(null)
    reset({
      name: '',
      description: null,
    })
    setModalOpen(true)
  }

  const handleEditGroup = (group: TripGroupListItem) => {
    setSelectedGroup(group)
    reset({
      name: group.name,
      description: group.description,
    })
    setModalOpen(true)
  }

  const handleExpandGroup = (group: TripGroupListItem) => {
    if (expandedGroupId === group.id) {
      setExpandedGroupId(null)
      setSelectedGroupId(null)
    } else {
      setExpandedGroupId(group.id)
      setSelectedGroupId(group.id)
    }
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
        await createMutation.mutateAsync({
          ...data,
          day_of_week: selectedDay,
        })
        toast.success('Trip group created successfully')
      }
      setModalOpen(false)
    } catch {
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
      if (expandedGroupId === selectedGroup.id) {
        setExpandedGroupId(null)
        setSelectedGroupId(null)
      }
    } catch {
      toast.error('Failed to delete trip group')
    }
  }

  const handleAddTemplate = async (templateId: number) => {
    if (!expandedGroupId) return
    try {
      await addTemplatesMutation.mutateAsync({
        id: expandedGroupId,
        template_ids: [templateId],
      })
      toast.success('Template added to group')
    } catch {
      toast.error('Failed to add template')
    }
  }

  const handleRemoveTemplate = async (templateId: number) => {
    if (!expandedGroupId) return
    try {
      await removeTemplateMutation.mutateAsync({
        groupId: expandedGroupId,
        templateId,
      })
      toast.success('Template removed from group')
    } catch {
      toast.error('Failed to remove template')
    }
  }

  const formatTime = (time: string) => time.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trip Groups</h1>
          <p className="mt-1 text-sm text-gray-500">
            Group weekly templates by day for driver assignment
          </p>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          {DAYS.map((day) => (
            <button
              key={day.value}
              onClick={() => handleDayChange(day.value)}
              className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                selectedDay === day.value
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {day.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Trip Groups for this day */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Trip Groups - {DAYS[selectedDay].label}
            </h2>
            {canEdit && (
              <Button size="sm" onClick={handleAddGroup}>
                <Plus className="h-4 w-4" />
                Add Group
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {groupsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size="lg" />
            </div>
          ) : groupsData?.items.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <Layers className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No trip groups</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create a trip group for {DAYS[selectedDay].label} to organize templates.
                </p>
                {canEdit && (
                  <Button className="mt-4" onClick={handleAddGroup}>
                    <Plus className="h-4 w-4" />
                    Add Trip Group
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {groupsData?.items.map((group) => (
                <Card
                  key={group.id}
                  className={`cursor-pointer transition-all ${
                    expandedGroupId === group.id
                      ? 'ring-2 ring-primary-500 shadow-md'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleExpandGroup(group)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          expandedGroupId === group.id
                            ? 'bg-primary-500 text-white'
                            : 'bg-primary-100 text-primary-600'
                        }`}
                      >
                        <Layers className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{group.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="info" className="text-xs">
                            {group.template_count} templates
                          </Badge>
                          {group.description && (
                            <span className="text-xs text-gray-500 line-clamp-1">
                              {group.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditGroup(group)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(group)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Expanded view - show templates in this group */}
                  {expandedGroupId === group.id && groupDetail && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Templates in this group:
                      </div>
                      {groupDetail.templates.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">
                          No templates yet. Add templates from the right panel.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {groupDetail.templates
                            .sort((a, b) => a.start_time.localeCompare(b.start_time))
                            .map((t) => (
                              <div
                                key={t.id}
                                className="flex items-center justify-between bg-gray-50 rounded p-2"
                              >
                                <div className="flex items-center gap-3">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm">
                                    {formatTime(t.start_time)} - {formatTime(t.end_time)}
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveTemplate(t.id)
                                    }}
                                  >
                                    <X className="h-4 w-4 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Available Templates */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Available Templates - {DAYS[selectedDay].label}
          </h2>

          {templatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size="lg" />
            </div>
          ) : availableTemplates.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {dayTemplates.length === 0
                    ? 'No templates for this day'
                    : 'All templates assigned'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {dayTemplates.length === 0
                    ? `Create weekly templates for ${DAYS[selectedDay].label} first.`
                    : expandedGroupId
                    ? 'All templates for this day are already in this group.'
                    : 'Select a group to manage its templates.'}
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {expandedGroupId
                    ? 'Click to add to selected group'
                    : 'Select a group first'}
                </CardTitle>
              </CardHeader>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {availableTemplates
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((template) => (
                    <div
                      key={template.id}
                      className={`flex items-center justify-between rounded p-3 transition-colors ${
                        expandedGroupId && canEdit
                          ? 'bg-gray-50 hover:bg-primary-50 cursor-pointer'
                          : 'bg-gray-50'
                      }`}
                      onClick={() => {
                        if (expandedGroupId && canEdit) {
                          handleAddTemplate(template.id)
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">
                          {formatTime(template.start_time)} - {formatTime(template.end_time)}
                        </span>
                        <span className="text-sm font-semibold text-primary-600">
                          {template.customer.code}
                        </span>
                        <span className="text-sm text-gray-500">
                          {template.customer.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {template.volume.toLocaleString()} L
                        </Badge>
                      </div>
                      {expandedGroupId && canEdit && (
                        <ArrowRight className="h-4 w-4 text-primary-500" />
                      )}
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedGroup ? 'Edit Trip Group' : `Add Trip Group - ${DAYS[selectedDay].label}`}
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
