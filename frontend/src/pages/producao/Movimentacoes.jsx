import { useState, useEffect } from 'react'
import api from '../../api'

const TYPE_COLORS = {
  entrada: 'text-green-600 bg-green-50',
  saida: 'text-red-600 bg-red-50',
  ajuste: 'text-blue-600 bg-blue-50',
  perda: 'text-red-700 bg-red-100',
  avaria: 'text-orange-600 bg-orange-50',
  reserva: 'text-yellow-600 bg-yellow-50',
  producao: 'text-green-700 bg-green-100',
}

export default function Movimentacoes() {
  const [movements, setMovements] = useState([])
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ sku_id: '', date_from: '', date_to: '' })

  const load = () => {
    setLoading(true)
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    api.get('/stock/movements', { params }).then(r => setMovements(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    api.get('/stock/skus').then(r => setSkus(r.data))
    load()
  }, [])

  const F = (k, v) => setFilters(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">SKU</label>
            <select value={filters.sku_id} onChange={e => F('sku_id', e.target.value)} className="input w-44">
              <option value="">Todos</option>
              {skus.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data Início</label>
            <input type="date" value={filters.date_from} onChange={e => F('date_from', e.target.value)} className="input w-36" />
          </div>
          <div>
            <label className="label">Data Fim</label>
            <input type="date" value={filters.date_to} onChange={e => F('date_to', e.target.value)} className="input w-36" />
          </div>
          <button onClick={load} className="btn-primary">Filtrar</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/></div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{movements.length} movimentação(ões)</p>
          {movements.map(m => (
            <div key={m.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 truncate">{m.sku_name}</div>
                  <div className="text-xs text-slate-500">{m.code}</div>
                  {m.reason && <div className="text-xs text-slate-400 mt-1">{m.reason}</div>}
                  <div className="text-xs text-slate-400 mt-1">
                    {m.operator_name && <span>Por: {m.operator_name} · </span>}
                    {m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : ''}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-sm font-black px-2 py-1 rounded-lg ${TYPE_COLORS[m.type] || 'text-slate-600 bg-slate-50'}`}>
                    {['entrada','producao'].includes(m.type) ? '+' : m.type === 'ajuste' ? '=' : '-'}{m.quantity}
                  </span>
                  <div className="text-xs text-slate-500 mt-1">{m.type}</div>
                </div>
              </div>
            </div>
          ))}
          {movements.length === 0 && <div className="text-center py-10 text-slate-400">Nenhuma movimentação</div>}
        </div>
      )}
    </div>
  )
}
