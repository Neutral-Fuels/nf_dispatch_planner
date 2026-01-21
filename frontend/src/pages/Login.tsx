import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Fuel } from 'lucide-react'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Alert } from '../components/common/Alert'
import { authService } from '../services/auth'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function Login() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null)
      setIsLoading(true)

      await authService.login(data)

      // Redirect to the page they tried to visit or home
      const from = (location.state as any)?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid username or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Fuel className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">NF Dispatch Planner</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fuel Delivery Schedule Management
          </p>
        </div>

        {/* Login form */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">Sign in</h2>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Username"
              type="text"
              autoComplete="username"
              error={errors.username?.message}
              {...register('username')}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            Contact your administrator if you need access
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Neutral Fuels LLC &copy; 2025
        </p>
      </div>
    </div>
  )
}
