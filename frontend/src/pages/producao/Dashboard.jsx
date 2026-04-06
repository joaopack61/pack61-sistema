import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'
import KPICard from '../../components/KPICard'

export default function ProducaoDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent"/></div>
  if (!data) return null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KPICard label="Pendentes" value={data.pending} icon="⏳" color="yellow" />
        <KPICard label="Em Produção" value={data.in_production} icon="⚙️" color="blue" />
        <KPICard label="Pronto Expedição" value={data.ready} icon="📦" color="purple" />
        <KPICard label="Produzidos (mês)" value={data.done_month} icon="✅" color="green" />
      </div>

      {data.low_stock?.length > 0 && (
        <div className="card p-4 border-red-200 border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-500">⚠️</span>
            <h3 className="font-bold text-red-700 text-sm">Estoque Crítico</h3>
          </div>
          <div className="space-y-2">
            {data.low_stock.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium truncate">{s.name}</span>
                <span className="text-red-600 font-bold ml-2 flex-shrink-0">{s.quantity_available} / mín {s.min_stock}</span>
              </div>
            ))}
          </div>
          <Link to="/producao/estoque" className="text-xs text-brand-500 font-semibold mt-2 block">Ver estoque completo →</Link>
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 text-sm">Movimentações Recentes</h3>
          <Link to="/producao/movimentacoes" className="text-xs text-brand-500 font-semibold">Ver todas</Link>
        </div>
        <div className="space-y-2">
          {data.recent_movements?.length > 0 ? data.recent_movements.map((m, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
              <span className={`text-sm font-bold ${['entrada','producao'].includes(m.type) ? 'text-green-600' : m.type === 'ajuste' ? 'text-blue-600' : 'text-red-600'}`}>
                {['entrada','producao'].includes(m.type) ? '+' : '-'}{m.quantity}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-700 truncate">{m.sku_name}</div>
                <div className="text-xs text-slate-400">{m.type} · {m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : ''}</div>
              </div>
            </div>
          )) : <p className="text-slate-400 text-sm">Nenhuma movimentação</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/producao/pedidos" className="bg-brand-500 text-white rounded-xl p-4 text-center font-bold block hover:bg-brand-600 transition-colors">⚙️ Ver Produção</Link>
        <Link to="/producao/estoque" className="bg-slate-800 text-white rounded-xl p-4 text-center font-bold block hover:bg-slate-700 transition-colors">📦 Ver Estoque</Link>
      </div>
    </div>
  )
}
