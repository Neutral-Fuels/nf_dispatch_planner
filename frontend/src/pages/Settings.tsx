import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Settings as SettingsIcon, User, Lock, Bell, Palette, Clock, Save } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Select } from '../components/common/Select'
import { Badge } from '../components/common/Badge'
import { Modal, ModalFooter } from '../components/common/Modal'
import { useAuth } from '../hooks/useAuth'
import { toast } from '../store/toastStore'
import { api } from '../services/api'

// Password change schema
const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

type PasswordFormData = z.infer<typeof passwordSchema>

// Profile schema
const profileSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().email('Invalid email address'),
})

type ProfileFormData = z.infer<typeof profileSchema>

export function Settings() {
  const { user, updateUser } = useAuth()
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      email: user?.email || '',
    },
  })

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsUpdating(true)
    try {
      const response = await api.put('/auth/me', {
        full_name: data.full_name || null,
        email: data.email,
      })
      updateUser(response.data)
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setIsUpdating(false)
    }
  }

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsChangingPassword(true)
    try {
      await api.post('/auth/change-password', {
        current_password: data.current_password,
        new_password: data.new_password,
      })
      toast.success('Password changed successfully')
      setPasswordModalOpen(false)
      passwordForm.reset()
    } catch (error: any) {
      if (error.response?.status === 400) {
        toast.error('Current password is incorrect')
      } else {
        toast.error('Failed to change password')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your account and application preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - Settings navigation */}
        <div className="lg:col-span-1">
          <Card>
            <nav className="space-y-1">
              <a
                href="#profile"
                className="flex items-center gap-3 rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700"
              >
                <User className="h-5 w-5" />
                Profile
              </a>
              <a
                href="#security"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                <Lock className="h-5 w-5" />
                Security
              </a>
              <a
                href="#preferences"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                <Palette className="h-5 w-5" />
                Preferences
              </a>
              <a
                href="#notifications"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                <Bell className="h-5 w-5" />
                Notifications
              </a>
            </nav>
          </Card>
        </div>

        {/* Right column - Settings content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Section */}
          <Card id="profile">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
                <p className="text-sm text-gray-500">Update your account profile details</p>
              </div>
            </div>

            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                      {user?.username}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Username cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                      <Badge variant={user?.role === 'admin' ? 'success' : user?.role === 'dispatcher' ? 'info' : 'secondary'}>
                        {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Input
                  label="Full Name"
                  {...profileForm.register('full_name')}
                  error={profileForm.formState.errors.full_name?.message}
                />

                <Input
                  label="Email"
                  type="email"
                  {...profileForm.register('email')}
                  error={profileForm.formState.errors.email?.message}
                />

                <div className="flex justify-end">
                  <Button type="submit" isLoading={isUpdating}>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </Card>

          {/* Security Section */}
          <Card id="security">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Security</h2>
                <p className="text-sm text-gray-500">Manage your password and security settings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div>
                  <div className="font-medium text-gray-900">Password</div>
                  <div className="text-sm text-gray-500">Change your account password</div>
                </div>
                <Button variant="secondary" onClick={() => setPasswordModalOpen(true)}>
                  Change Password
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div>
                  <div className="font-medium text-gray-900">Last Login</div>
                  <div className="text-sm text-gray-500">
                    {user?.last_login
                      ? new Date(user.last_login).toLocaleString()
                      : 'This is your first login'}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Preferences Section */}
          <Card id="preferences">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
                <p className="text-sm text-gray-500">Customize your application experience</p>
              </div>
            </div>

            <div className="space-y-4">
              <Select
                label="Timezone"
                options={[
                  { value: 'Asia/Dubai', label: 'Dubai (GST, UTC+4)' },
                  { value: 'Asia/Abu_Dhabi', label: 'Abu Dhabi (GST, UTC+4)' },
                ]}
                value="Asia/Dubai"
                onChange={() => {}}
              />

              <Select
                label="Date Format"
                options={[
                  { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY (31/12/2024)' },
                  { value: 'MM/dd/yyyy', label: 'MM/DD/YYYY (12/31/2024)' },
                  { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD (2024-12-31)' },
                ]}
                value="dd/MM/yyyy"
                onChange={() => {}}
              />

              <Select
                label="Time Format"
                options={[
                  { value: '24h', label: '24-hour (14:30)' },
                  { value: '12h', label: '12-hour (2:30 PM)' },
                ]}
                value="24h"
                onChange={() => {}}
              />

              <div className="flex justify-end pt-4">
                <Button disabled>
                  <Save className="h-4 w-4" />
                  Save Preferences
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-right">
                Preference customization coming soon
              </p>
            </div>
          </Card>

          {/* Notifications Section */}
          <Card id="notifications">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                <p className="text-sm text-gray-500">Configure how you receive notifications</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div>
                  <div className="font-medium text-gray-900">Email Notifications</div>
                  <div className="text-sm text-gray-500">Receive email alerts for important updates</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" disabled />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div>
                  <div className="font-medium text-gray-900">Schedule Alerts</div>
                  <div className="text-sm text-gray-500">Get notified about unassigned trips and conflicts</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked disabled />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <p className="text-xs text-gray-400 text-center pt-2">
                Notification settings coming soon
              </p>
            </div>
          </Card>

          {/* System Info */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                <SettingsIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">System Information</h2>
                <p className="text-sm text-gray-500">Application details and version</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Application</div>
                <div className="font-medium text-gray-900">NF Dispatch Planner</div>
              </div>
              <div>
                <div className="text-gray-500">Version</div>
                <div className="font-medium text-gray-900">1.0.0</div>
              </div>
              <div>
                <div className="text-gray-500">Environment</div>
                <div className="font-medium text-gray-900">
                  <Badge variant="info">Development</Badge>
                </div>
              </div>
              <div>
                <div className="text-gray-500">Timezone</div>
                <div className="flex items-center gap-1 font-medium text-gray-900">
                  <Clock className="h-4 w-4" />
                  GST (UTC+4)
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title="Change Password"
        size="sm"
      >
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
          <div className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              required
              {...passwordForm.register('current_password')}
              error={passwordForm.formState.errors.current_password?.message}
            />

            <Input
              label="New Password"
              type="password"
              required
              {...passwordForm.register('new_password')}
              error={passwordForm.formState.errors.new_password?.message}
            />

            <Input
              label="Confirm New Password"
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
            <Button type="submit" isLoading={isChangingPassword}>
              Change Password
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}
