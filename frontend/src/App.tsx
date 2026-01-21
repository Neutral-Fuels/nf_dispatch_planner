import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { ToastContainer } from './components/common/Toast'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Drivers } from './pages/Drivers'
import { Tankers } from './pages/Tankers'
import { Customers } from './pages/Customers'
import { DailySchedule } from './pages/DailySchedule'
import { WeeklyTemplates } from './pages/WeeklyTemplates'
import { DriverSchedule } from './pages/DriverSchedule'
import { DriverTripSheet } from './pages/DriverTripSheet'
import { Users } from './pages/Users'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule/:date?" element={<DailySchedule />} />
            <Route path="/templates" element={<WeeklyTemplates />} />
            <Route path="/driver-schedule" element={<DriverSchedule />} />
            <Route path="/driver-trip-sheet" element={<DriverTripSheet />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/tankers" element={<Tankers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/users" element={<Users />} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Toast notifications */}
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
