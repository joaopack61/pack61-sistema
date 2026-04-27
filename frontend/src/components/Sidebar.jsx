import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
    { to: '/admin/pedidos', label: 'Pedidos', icon: '📋' },
    { to: '/admin/logistica', label: 'Logística', icon: '🚚' },
    { to: '/admin/vendedores', label: 'Vendedores', icon: '🧑‍💼' },
    { to: '/admin/clientes', label: 'Clientes', icon: '🏢' },
    { to: '/admin/financeiro', label: 'Financeiro', icon: '💰' },
    { to: '/admin/produtos', label: 'Produtos', icon: '📦' },
    { to: '/admin/relatorios', label: 'Relatórios', icon: '📈' },
    { to: '/admin/usuarios', label: 'Usuários', icon: '👥' },
  ],
  vendedor: [
    { to: '/vendedor', label: 'Início', icon: '📊', end: true },
    { to: '/vendedor/nova-visita', label: 'Nova Visita', icon: '➕' },
    { to: '/vendedor/visitas', label: 'Minhas Visitas', icon: '📋' },
    { to: '/vendedor/clientes', label: 'Clientes', icon: '🏢' },
  ],
  motorista: [
    { to: '/motorista', label: 'Início', icon: '📊', end: true },
    { to: '/motorista/entregas', label: 'Entregas', icon: '🚚' },
  ],
  producao: [
    { to: '/producao', label: 'Início', icon: '📊', end: true },
    { to: '/producao/pedidos', label: 'Fila de Produção', icon: '⚙️' },
    { to: '/producao/estoque', label: 'Estoque', icon: '📦' },
    { to: '/producao/movimentacoes', label: 'Movimentações', icon: '🔄' },
  ],
}

const ROLE_LABEL = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  motorista: 'Motorista',
  producao: 'Produção / Estoque',
}

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = NAV[user?.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`
      fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col
      transition-transform duration-300 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/60 flex-shrink-0">
        <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md shadow-brand-900/50">
          P
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm leading-tight">Pack61</div>
          <div className="text-slate-400 text-xs truncate">{ROLE_LABEL[user?.role]}</div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-slate-500 hover:text-white w-7 h-7 flex items-center justify-center rounded"
          aria-label="Fechar menu"
        >
          ✕
        </button>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-100
              ${isActive
                ? 'bg-brand-500 text-white shadow-sm shadow-brand-800/50'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`
            }
          >
            <span className="text-base w-5 text-center">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 font-bold text-xs flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-200 text-xs font-semibold truncate">{user?.name}</div>
            <div className="text-slate-500 text-xs truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors"
        >
          <span className="w-5 text-center text-base">🚪</span>
          Sair
        </button>
      </div>
    </aside>
  )
}
