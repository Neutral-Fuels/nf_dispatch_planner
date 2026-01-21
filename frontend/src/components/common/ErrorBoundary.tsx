import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from './Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    // Log error to console in development
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleRefresh = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-6">
              An unexpected error occurred. Please try refreshing the page or going back to the dashboard.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 text-left">
                <details className="bg-gray-100 rounded-lg p-4">
                  <summary className="cursor-pointer font-medium text-sm text-gray-700">
                    Error details (development only)
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={this.handleGoHome}>
                <Home className="h-4 w-4" />
                Go Home
              </Button>
              <Button onClick={this.handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional wrapper for use in route boundaries
export function ErrorFallback({
  error,
  resetError
}: {
  error?: Error
  resetError?: () => void
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => window.location.href = '/'}>
            <Home className="h-4 w-4" />
            Go Home
          </Button>
          <Button onClick={resetError || (() => window.location.reload())}>
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}
