import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, Filter, UserCog, Key, Mail, Shield } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Select } from '../components/common/Select'
import { Badge } from '../components/common/Badge'
import { Table } from '../components/common/Table'
import { Modal, ModalFooter } from '../components/common/Modal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useChangeUserPassword } from '../hooks/useUsers'
import { toast } from '../store/toastStore'
import { User, UserRole } from '../types/api'
import { useAuth } from '../hooks/useAuth'

// Form validation schema for create
const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().nullable().optional(),
  role: z.enum(['admin', 'dispatcher', 'viewer']),
  is_active: z.boolean().default(true),
})

// Form validation schema for edit (no password)
const editUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  full_name: z.string().nullable().optional(),
  role: z.enum(['admin', 'dispatcher', 'viewer']),
  is_active: z.boolean().default(true),
})

// Password change schema
const passwordSchema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

type CreateUserFormData = z.infer<typeof createUserSchema>
type EditUserFormData = z.infer<typeof editUserSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

// Role badge variants
const ROLE_CONFIG: Record<UserRole, { label: string; variant: 'success' | 'info' | 'secondary' }> = {
  admin: { label: 'Admin', variant: 'success' },
  dispatcher: { label: 'Dispatcher', variant: 'info' },
  viewer: { label: 'Viewer', variant: 'secondary' },
}

export function Users() {
  const { user: currentUser, canEdit } = useAuth()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Query params
  const queryParams = {
    search: search || undefined,
    role: roleFilter || undefined,
    per_page: 20,
  }

  // Queries and mutations
  const { data, isLoading } = useUsers(queryParams)
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()
  const changePasswordMutation = useChangeUserPassword()

  // Create form
  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      full_name: null,
      role: 'viewer',
      is_active: true,
    },
  })

  // Edit form
  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: '',
      email: '',
      full_name: null,
      role: 'viewer',
      is_active: true,
    },
  })

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      new_password: '',
      confirm_password: '',
    },
  })

  // Table columns
  const columns: ColumnDef<User>[] = useMemo(
    () => [
      {
        accessorKey: 'username',
        header: 'User',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{row.original.username}</div>
              <div className="text-xs text-gray-500">{row.original.full_name || 'No name'}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-sm">{row.original.email}</span>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => {
          const config = ROLE_CONFIG[row.original.role]
          return (
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
          )
        },
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
      {
        accessorKey: 'last_login',
        header: 'Last Login',
        cell: ({ row }) =>
          row.original.last_login
            ? format(new Date(row.original.last_login), 'dd/MM/yyyy HH:mm')
            : 'Never',
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }: { row: { original: User } }) => (
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
                      handleChangePassword(row.original)
                    }}
                    title="Change Password"
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick(row.original)
                    }}
                    disabled={row.original.id === currentUser?.id}
                    title={row.original.id === currentUser?.id ? "Can't delete yourself" : 'Delete'}
                  >
                    <Trash2 className={`h-4 w-4 ${row.original.id === currentUser?.id ? 'text-gray-300' : 'text-red-500'}`} />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canEdit, currentUser?.id]
  )

  // Handlers
  const handleAdd = () => {
    setSelectedUser(null)
    createForm.reset({
      username: '',
      email: '',
      password: '',
      full_name: null,
      role: 'viewer',
      is_active: true,
    })
    setModalOpen(true)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    editForm.reset({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    })
    setModalOpen(true)
  }

  const handleChangePassword = (user: User) => {
    setSelectedUser(user)
    passwordForm.reset({
      new_password: '',
      confirm_password: '',
    })
    setPasswordModalOpen(true)
  }

  const handleDeleteClick = (user: User) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  const onCreateSubmit = async (data: CreateUserFormData) => {
    try {
      await createMutation.mutateAsync({
        ...data,
        full_name: data.full_name || null,
      })
      toast.success('User created successfully')
      setModalOpen(false)
    } catch (error) {
      toast.error('Failed to create user')
    }
  }

  const onEditSubmit = async (data: EditUserFormData) => {
    if (!selectedUser) return
    try {
      await updateMutation.mutateAsync({
        id: selectedUser.id,
        ...data,
        full_name: data.full_name || null,
      })
      toast.success('User updated successfully')
      setModalOpen(false)
    } catch (error) {
      toast.error('Failed to update user')
    }
  }

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (!selectedUser) return
    try {
      await changePasswordMutation.mutateAsync({
        id: selectedUser.id,
        new_password: data.new_password,
      })
      toast.success('Password changed successfully')
      setPasswordModalOpen(false)
    } catch (error) {
      toast.error('Failed to change password')
    }
  }

  const handleDelete = async () => {
    if (!selectedUser) return
    try {
      await deleteMutation.mutateAsync(selectedUser.id)
      toast.success('User deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedUser(null)
    } catch (error) {
      toast.error('Failed to delete user')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage system users and access roles
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add User
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
                placeholder="Search users..."
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
              label="Role"
              options={[
                { value: '', label: 'All Roles' },
                { value: 'admin', label: 'Admin' },
                { value: 'dispatcher', label: 'Dispatcher' },
                { value: 'viewer', label: 'Viewer' },
              ]}
              value={roleFilter}
              onChange={(value) => setRoleFilter(value as UserRole | '')}
            />
            <div></div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setRoleFilter('')
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
          searchColumn="username"
          searchValue={search}
          emptyMessage="No users found"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedUser ? 'Edit User' : 'Add User'}
        size="md"
      >
        {selectedUser ? (
          // Edit form
          <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
            <div className="space-y-4">
              <Input
                label="Username"
                required
                {...editForm.register('username')}
                error={editForm.formState.errors.username?.message}
              />

              <Input
                label="Email"
                type="email"
                required
                {...editForm.register('email')}
                error={editForm.formState.errors.email?.message}
              />

              <Input
                label="Full Name"
                {...editForm.register('full_name')}
                error={editForm.formState.errors.full_name?.message}
              />

              <Select
                label="Role"
                required
                options={[
                  { value: 'admin', label: 'Admin - Full access to all features' },
                  { value: 'dispatcher', label: 'Dispatcher - Can manage schedules' },
                  { value: 'viewer', label: 'Viewer - Read-only access' },
                ]}
                {...editForm.register('role')}
                error={editForm.formState.errors.role?.message}
              />

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...editForm.register('is_active')}
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
                isLoading={updateMutation.isPending}
              >
                Update
              </Button>
            </ModalFooter>
          </form>
        ) : (
          // Create form
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
            <div className="space-y-4">
              <Input
                label="Username"
                required
                {...createForm.register('username')}
                error={createForm.formState.errors.username?.message}
              />

              <Input
                label="Email"
                type="email"
                required
                {...createForm.register('email')}
                error={createForm.formState.errors.email?.message}
              />

              <Input
                label="Password"
                type="password"
                required
                {...createForm.register('password')}
                error={createForm.formState.errors.password?.message}
              />

              <Input
                label="Full Name"
                {...createForm.register('full_name')}
                error={createForm.formState.errors.full_name?.message}
              />

              <Select
                label="Role"
                required
                options={[
                  { value: 'admin', label: 'Admin - Full access to all features' },
                  { value: 'dispatcher', label: 'Dispatcher - Can manage schedules' },
                  { value: 'viewer', label: 'Viewer - Read-only access' },
                ]}
                {...createForm.register('role')}
                error={createForm.formState.errors.role?.message}
              />

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...createForm.register('is_active')}
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
                isLoading={createMutation.isPending}
              >
                Create
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title={`Change Password - ${selectedUser?.username}`}
        size="sm"
      >
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
          <div className="space-y-4">
            <Input
              label="New Password"
              type="password"
              required
              {...passwordForm.register('new_password')}
              error={passwordForm.formState.errors.new_password?.message}
            />

            <Input
              label="Confirm Password"
              type="password"
              required
              {...passwordForm.register('confirm_password')}
              error={passwordForm.formState.errors.confirm_password?.message}
            />
          </div>

          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={changePasswordMutation.isPending}
            >
              Change Password
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete "${selectedUser?.username}"? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
