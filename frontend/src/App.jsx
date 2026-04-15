import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminClients from './pages/admin/Clients'
import AdminPedidos from './pages/admin/Pedidos'
import AdminLogistica from './pages/admin/Logistica'
import AdminReports from './pages/admin/Reports'
import Financeiro from './pages/admin/Financeiro'
import Produtos from './pages/admin/Produtos'
import VendedorDashboard from './pages/vendedor/Dashboard'
import NovaVisita from './pages/vendedor/NovaVisita'
import Visitas from './pages/vendedor/Visitas'
import VendedorClientes from './pages/vendedor/Clientes'
import MotoristaDashboard from './pages/motorista/Dashboard'
import Entregas from './pages/motorista/Entregas'
import ProducaoDashboard from './pages/producao/Dashboard'
import ProducaoPedidos from './pages/producao/Pedidos'
import Estoque from './pages/producao/Estoque'
import Movimentacoes from './pages/producao/Movimentacoes'

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent"/>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  const map = { admin: '/admin', vendedor: '/vendedor', motorista: '/motorista', producao: '/producao' }
  return <Navigate to={map[user.role] || '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Layout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="pedidos" element={<AdminPedidos />} />
            <Route path="logistica" element={<AdminLogistica />} />
            <Route path="clientes" element={<AdminClients />} />
            <Route path="relatorios" element={<AdminReports />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="produtos" element={<Produtos />} />
          </Route>

          <Route path="/vendedor" element={<ProtectedRoute roles={['vendedor']}><Layout /></ProtectedRoute>}>
            <Route index element={<VendedorDashboard />} />
            <Route path="nova-visita" element={<NovaVisita />} />
            <Route path="visitas" element={<Visitas />} />
            <Route path="clientes" element={<VendedorClientes />} />
          </Route>

          <Route path="/motorista" element={<ProtectedRoute roles={['motorista']}><Layout /></ProtectedRoute>}>
            <Route index element={<MotoristaDashboard />} />
            <Route path="entregas" element={<Entregas />} />
          </Route>

          <Route path="/producao" element={<ProtectedRoute roles={['producao']}><Layout /></ProtectedRoute>}>
            <Route index element={<ProducaoDashboard />} />
            <Route path="pedidos" element={<ProducaoPedidos />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="movimentacoes" element={<Movimentacoes />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
