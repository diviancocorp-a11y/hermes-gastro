import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Catalog from './pages/Catalog'

// Lazy-load admin, tracker & account: catalog visitors don't download these chunks
const Admin = lazy(() => import('./pages/Admin'))
const OrderTracker = lazy(() => import('./pages/OrderTracker'))
const MyAccount = lazy(() => import('./pages/MyAccount'))

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <p style={{ color: '#9C8B7A', fontSize: 15 }}>Cargando...</p>
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/order/:id" element={<OrderTracker />} />
            <Route path="/mi-cuenta" element={<MyAccount />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  )
}
