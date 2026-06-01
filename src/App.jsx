import { Routes, Route } from 'react-router-dom'
import QrRedirect from './pages/QrRedirect'
import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import SkipToContent from './components/ui/SkipToContent'
import OfflineBanner from './components/ui/OfflineBanner'
import useTheme from './hooks/useTheme'
import Catalog from './pages/Catalog'

// Lazy-load admin, tracker & account: catalog visitors don't download these chunks
const Admin = lazy(() => import('./pages/Admin'))
const OrderTracker = lazy(() => import('./pages/OrderTracker'))
const MyAccount = lazy(() => import('./pages/MyAccount'))
const MpCallback = lazy(() => import('./pages/MpCallback'))
const MpStatus = lazy(() => import('./pages/MpStatus'))

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <p style={{ color: '#9C8B7A', fontSize: 15 }}>Cargando...</p>
  </div>
)

export default function App() {
  // Initialize theme (sets data-theme on <html>, listens for system changes)
  useTheme();

  return (
    <ErrorBoundary>
      <SkipToContent />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <main id="main-content">
            <Routes>
              <Route path="/" element={<Catalog />} />
              <Route path="/q/:slug" element={<QrRedirect />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/order/:id" element={<OrderTracker />} />
              <Route path="/mi-cuenta" element={<MyAccount />} />
              <Route path="/mp-callback" element={<MpCallback />} />
              <Route path="/pago/exitoso" element={<MpStatus status="exitoso" />} />
              <Route path="/pago/fallido" element={<MpStatus status="fallido" />} />
              <Route path="/pago/pendiente" element={<MpStatus status="pendiente" />} />
            </Routes>
            </main>
          </Suspense>
        </AuthProvider>
      </QueryClientProvider>
      <OfflineBanner />
    </ErrorBoundary>
  )
}
