import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Catalog from './pages/Catalog'

// Lazy-load admin & tracker: catalog visitors don't download these chunks
const Admin = lazy(() => import('./pages/Admin'))
const OrderTracker = lazy(() => import('./pages/OrderTracker'))

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <p style={{ color: '#9C8B7A', fontSize: 15 }}>Cargando...</p>
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/order/:id" element={<OrderTracker />} />
      </Routes>
    </Suspense>
  )
}
