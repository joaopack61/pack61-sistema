import { useState, useEffect } from 'react'
import api from '../../api'

const REPORTS = [
  { key: 'visits', label: 'Visitas', endpoint: '/reports/visits' },
  { key: 'orders', label: 'Pedidos', endpoint: '/reports/orders' },
  { key: 'deliveries', label: 'Entregas', endpoint: '/reports/deliveries' },
  { key: 'stock', label: 'Estoque Atual', endpoint: '/reports/stock' },
  { key: 'loss-reasons', label: 'Motivos de Perda', endpoint: '/reports/loss-reasons' },
  { key: 'tubes', label: 'Tubos Recolhidos', endpoint: '/reports/tubes' },
  { key: 'canhotos', label: 'Canhotos', endpoint: '/reports/canhotos' },
  { key: 'next-purchases', label: 'Próximas Recompras', endpoint: '/reports/next-purchases' },
]

export default function AdminReports() {
  const [active, setActive] = useState(REPORTS[0])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ date_from: '', date_to: '', seller_id: '', status: '' })
  const [sellers, setSellers] = useState([])

  useEffect(() => { api.get('/users').then(r => setSellers(r.data.filter(u => u.role === 'vendedor'))) }, [])

  const loadReport = async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      const r = await api.get(active.endpoint, { params })
      setData(r.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [active])

  const F = (k, v) => setFilters(p => ({ ...p, [k]: v }))

  const exportCSV = () => {
    if (!data.length) return
    const keys = Object.keys(data[0])
    const rows = [keys.join(','), ...data.map(r => keys.map(k => `"${(r[k] ?? '').toString().replace(/"/g, '""')}"`).join(','))]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${active.key}_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const renderValue = (v) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'number') return v.toLocaleString('pt-BR')
    if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}T/)) return new Date(v).toLocaleString('pt-BR')
    return String(v)
  }

  const displayKeys = data.length > 0 ? Object.keys(data[0]).filter(k => !['id', 'password_hash'].includes(k)) : []

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {REPORTS.map(r => (
          <button key={r.key} onClick={() => { setActive(r); setData([]) }}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${active.key === r.key ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {r.label}
          </button>
        ))}
      </div>

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
          {['visits','orders','loss-reasons','next-purchases'].includes(active.key) && (
            <div>
              <label className="label">Vendedor</label>
              <select value={filters.seller_id} onChange={e => F('seller_id', e.target.value)} className="input w-40">
                <option value="">Todos</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {active.key === 'orders' && (
            <div>
              <label className="label">Status</label>
              <select value={filters.status} onChange={e => F('status', e.target.value)} className="input w-40">
                <option value="">Todos</option>
                {['pendente','em_producao','pronto_expedicao','entregue','cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <button onClick={loadReport} className="btn-primary">Filtrar</button>
          {data.length > 0 && <button onClick={exportCSV} className="btn-secondary">Exportar CSV</button>}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/></div>
        ) : (
          <div className="overflow-x-auto">
            <p className="px-4 py-2 text-xs text-slate-500 border-b">{data.length} registro(s)</p>
            {displayKeys.length > 0 ? (
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 border-b">
                  {displayKeys.map(k => <th key={k} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{k.replace(/_/g,' ')}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.slice(0, 100).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {displayKeys.map(k => (
                        <td key={k} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">{renderValue(row[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="text-center py-10 text-slate-400">Sem dados para exibir</div>}
            {data.length > 100 && <p className="px-4 py-2 text-xs text-slate-400">Mostrando 100 de {data.length}. Exporte CSV para ver todos.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
