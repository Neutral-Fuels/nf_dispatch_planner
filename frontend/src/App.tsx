import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Drivers } from './pages/Drivers'
import { Tankers } from './pages/Tankers'
import { Customers } from './pages/Customers'
import { DailySchedule } from './pages/DailySchedule'
import { WeeklyTemplates } from './pages/WeeklyTemplates'
import { Users } from './pages/Users'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
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
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/tankers" element={<Tankers />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/users" element={<Users />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
