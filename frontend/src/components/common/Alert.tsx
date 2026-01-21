import { HTMLAttributes, forwardRef } from 'react'
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'
import { cn } from '../../utils/formatters'

type AlertVariant = 'success' | 'warning' | 'error' | 'info'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, children, ...props }, ref) => {
    const variants = {
      success: {
        container: 'bg-green-50 border-green-200 text-green-800',
        icon: CheckCircle,
        iconColor: 'text-green-500',
      },
      warning: {
        container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        icon: AlertCircle,
        iconColor: 'text-yellow-500',
      },
      error: {
        container: 'bg-red-50 border-red-200 text-red-800',
        icon: XCircle,
        iconColor: 'text-red-500',
      },
      info: {
        container: 'bg-blue-50 border-blue-200 text-blue-800',
        icon: Info,
        iconColor: 'text-blue-500',
      },
    }

    const { container, icon: Icon, iconColor } = variants[variant]

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-3 rounded-lg border p-4',
          container,
          className
        )}
        {...props}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', iconColor)} />
        <div>
          {title && <p className="font-medium">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    )
  }
)

Alert.displayName = 'Alert'
