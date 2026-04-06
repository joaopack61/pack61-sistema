import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PAGE_TITLES = {
  '/admin': 'Dashboard',
  '/admin/usuarios': 'Usuários',
  '/admin/clientes': 'Clientes',
  '/admin/pedidos': 'Pedidos',
  '/admin/logistica': 'Logística',
  '/admin/relatorios': 'Relatórios',
  '/vendedor': 'Dashboard',
  '/vendedor/nova-visita': 'Nova Visita',
  '/vendedor/visitas': 'Minhas Visitas',
  '/vendedor/clientes': 'Meus Clientes',
  '/motorista': 'Dashboard',
  '/motorista/entregas': 'Entregas do Dia',
  '/producao': 'Dashboard',
  '/producao/pedidos': 'Fila de Produção',
  '/producao/estoque': 'Estoque',
  '/producao/movimentacoes': 'Movimentações',
}

export default function Header({ onMenuClick }) {
  const { user } = useAuth()
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'Pack61'
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-slate-600 hover:text-slate-900 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Menu"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="17" y2="6"/>
          <line x1="3" y1="10" x2="17" y2="10"/>
          <line x1="3" y1="14" x2="17" y2="14"/>
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-slate-800 leading-tight">{title}</h1>
        <p className="text-xs text-slate-400 capitalize hidden sm:block">{today}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <span className="hidden sm:block text-sm font-medium text-slate-700 truncate max-w-[120px]">{user?.name}</span>
      </div>
    </header>
  )
}
