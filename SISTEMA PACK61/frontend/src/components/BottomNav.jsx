import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BOTTOM_NAV = {
  admin: [
    { to: '/admin', label: 'Home', icon: '📊', end: true },
    { to: '/admin/pedidos', label: 'Pedidos', icon: '📋' },
    { to: '/admin/logistica', label: 'Logística', icon: '🚚' },
    { to: '/admin/financeiro', label: 'Financeiro', icon: '💰' },
    { to: '/admin/produtos', label: 'Produtos', icon: '📦' },
  ],
  vendedor: [
    { to: '/vendedor', label: 'Home', icon: '📊', end: true },
    { to: '/vendedor/nova-visita', label: 'Nova Visita', icon: '➕' },
    { to: '/vendedor/visitas', label: 'Visitas', icon: '📋' },
    { to: '/vendedor/clientes', label: 'Clientes', icon: '🏢' },
  ],
  motorista: [
    { to: '/motorista', label: 'Home', icon: '📊', end: true },
    { to: '/motorista/entregas', label: 'Entregas', icon: '🚚' },
  ],
  producao: [
    { to: '/producao', label: 'Home', icon: '📊', end: true },
    { to: '/producao/pedidos', label: 'Produção', icon: '⚙️' },
    { to: '/producao/estoque', label: 'Estoque', icon: '📦' },
    { to: '/producao/movimentacoes', label: 'Histórico', icon: '🔄' },
  ],
}

export default function BottomNav() {
  const { user } = useAuth()
  const links = BOTTOM_NAV[user?.role] || []

  if (links.length === 0) return null

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200">
      <div className="flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors
              ${isActive ? 'text-brand-500' : 'text-slate-400'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-500 rounded-b-full" />
                )}
                <span className="text-xl leading-none">{l.icon}</span>
                <span className="font-semibold leading-none" style={{ fontSize: '10px' }}>{l.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
