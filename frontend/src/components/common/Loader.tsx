import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/formatters'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Loader({ size = 'md', className }: LoaderProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <Loader2
      className={cn('animate-spin text-primary-600', sizes[size], className)}
    />
  )
}

// Full page loader
export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader size="lg" />
    </div>
  )
}

// Inline loader for content areas
export function ContentLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader size="md" />
    </div>
  )
}
