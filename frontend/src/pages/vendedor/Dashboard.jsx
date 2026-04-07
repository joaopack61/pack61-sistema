import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'
import KPICard from '../../components/KPICard'

export default function VendedorDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent"/></div>
  if (!data) return null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Visitas Hoje" value={data.my_visits_today} icon="👁️" color="brand" />
        <KPICard label="Visitas Semana" value={data.my_visits_week} icon="📅" color="blue" />
        <KPICard label="Pedidos (mês)" value={data.my_orders_month} icon="📦" color="green" />
        <KPICard label="Conversão" value={`${data.conversion_rate}%`} icon="🎯" color="purple" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KPICard label="Valor Vendido (mês)" value={`R$ ${Number(data.my_orders_value || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`} icon="💰" color="green" />
        <KPICard label="Sem Pedido (mês)" value={data.visits_no_order} icon="❌" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 text-sm">Próximas Recompras</h3>
          </div>
          {data.next_purchases?.length > 0 ? (
            <div className="space-y-2">
              {data.next_purchases.map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <div className="w-2 h-2 bg-brand-400 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{p.client_name}</div>
                    <div className="text-xs text-slate-500">{p.next_purchase_date ? new Date(p.next_purchase_date + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-400 text-sm">Nenhuma recompra prevista</p>}
        </div>

        <div className="card p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Motivos de Perda</h3>
          {data.loss_reasons?.length > 0 ? (
            <div className="space-y-2">
              {data.loss_reasons.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-500 w-6">{r.count}x</span>
                  <span className="text-sm text-slate-600 flex-1 truncate">{r.no_order_reason || 'N/A'}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-400 text-sm">Nenhum registro</p>}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 text-sm">Últimas Visitas</h3>
          <Link to="/vendedor/visitas" className="text-xs text-brand-500 font-semibold">Ver todas</Link>
        </div>
        <div className="space-y-2">
          {data.recent_visits?.map((v, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${v.took_order ? 'bg-green-400' : 'bg-red-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{v.client_name}</div>
                <div className="text-xs text-slate-500">{v.visit_date ? new Date(v.visit_date + 'T00:00:00').toLocaleDateString('pt-BR') : ''} · {v.took_order ? 'Pedido tirado' : v.no_order_reason || 'Sem pedido'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Link to="/vendedor/nova-visita" className="block">
        <div className="bg-brand-500 hover:bg-brand-600 text-white rounded-xl p-4 text-center font-bold transition-colors shadow-lg shadow-brand-500/30">
          + Registrar Nova Visita
        </div>
      </Link>
    </div>
  )
}
