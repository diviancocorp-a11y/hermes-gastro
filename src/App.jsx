import { Routes, Route } from 'react-router-dom'
import Catalog from './pages/Catalog'
import Admin from './pages/Admin'
import OrderTracker from './pages/OrderTracker'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Catalog />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/order/:id" element={<OrderTracker />} />
    </Routes>
  )
}