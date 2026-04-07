import { useState, useEffect } from 'react'
import api from '../../api'

export default function Visitas() {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ date_from: '', date_to: '', took_order: '' })

  const load = () => {
    setLoading(true)
    const p = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
    api.get('/visits', { params: p }).then(r => setVisits(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const F = (k, v) => setFilters(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Data Início</label>
            <input type="date" value={filters.date_from} onChange={e => F('date_from', e.target.value)} className="input w-36" />
          </div>
          <div>
            <label className="label">Data Fim</label>
            <input type="date" value={filters.date_to} onChange={e => F('date_to', e.target.value)} className="input w-36" />
          </div>
          <div>
            <label className="label">Pedido</label>
            <select value={filters.took_order} onChange={e => F('took_order', e.target.value)} className="input w-36">
              <option value="">Todos</option>
              <option value="1">Com pedido</option>
              <option value="0">Sem pedido</option>
            </select>
          </div>
          <button onClick={load} className="btn-primary">Filtrar</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/></div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{visits.length} visita(s)</p>
          {visits.map(v => (
            <div key={v.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.took_order ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="font-bold text-slate-800 truncate">{v.client_name}</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">{v.city} · {v.visit_date ? new Date(v.visit_date + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {v.took_order ? (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Pedido tirado</span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{v.no_order_reason || 'Sem pedido'}</span>
                    )}
                    {v.bobine_type && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{v.bobine_type}</span>}
                    {v.monthly_volume && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{v.monthly_volume} un/mês</span>}
                  </div>
                  {v.observations && <p className="text-xs text-slate-500 mt-2 italic">"{v.observations}"</p>}
                  {v.next_purchase_date && <p className="text-xs text-brand-600 mt-1 font-semibold">Próxima compra: {new Date(v.next_purchase_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
                </div>
                {v.photo && (
                  <a href={`/uploads/${v.photo}`} target="_blank" rel="noopener noreferrer">
                    <img src={`/uploads/${v.photo}`} alt="foto" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                  </a>
                )}
              </div>
            </div>
          ))}
          {visits.length === 0 && <div className="text-center py-10 text-slate-400">Nenhuma visita encontrada</div>}
        </div>
      )}
    </div>
  )
}
