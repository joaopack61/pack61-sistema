import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

export default function MotoristaDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent"/>
    </div>
  )
  if (!data) return null

  const pending = data.pending_list || []
  const hasPending = pending.length > 0

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* ── Botão principal ──────────────────────────── */}
      <Link to="/motorista/entregas">
        <div className={`rounded-2xl p-6 text-center transition-all active:scale-98 shadow-lg ${hasPending ? 'bg-brand-500 shadow-brand-500/30' : 'bg-green-500 shadow-green-500/20'}`}>
          <div className="text-5xl mb-3">{hasPending ? '🚚' : '🎉'}</div>
          <div className="text-white font-black text-xl">
            {hasPending ? `${pending.length} entrega${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''}` : 'Tudo entregue!'}
          </div>
          <div className="text-white/80 text-sm mt-1">
            {hasPending ? 'Toque para gerenciar entregas' : 'Nenhuma entrega pendente'}
          </div>
        </div>
      </Link>

      {/* ── KPIs do dia ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <div className="text-3xl font-black text-green-600">{data.done_today}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Entregues hoje</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-black text-brand-600">{data.pending}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Pendentes</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-black text-blue-600">{data.with_canhoto}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Canhotos (mês)</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-black text-slate-700">{data.tubes_today}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Tubos hoje</div>
        </div>
      </div>

      {/* ── Próximas entregas resumidas ──────────────── */}
      {hasPending && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 text-sm">Próximas entregas</h3>
            <Link to="/motorista/entregas" className="text-xs text-brand-500 font-semibold">Ver todas →</Link>
          </div>
          <div className="space-y-3">
            {pending.slice(0, 3).map((d, i) => (
              <Link
                key={d.id}
                to="/motorista/entregas"
                className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${i === 0 ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{d.client_name}</div>
                  <div className="text-xs text-slate-500 truncate">{d.address ? `${d.address}, ` : ''}{d.city}</div>
                </div>
                <span className="text-brand-500 text-lg">›</span>
              </Link>
            ))}
            {pending.length > 3 && (
              <Link to="/motorista/entregas" className="block text-center text-xs text-slate-400 pt-1">
                + {pending.length - 3} entrega(s) a mais
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Ação rápida de navegação ─────────────────── */}
      {hasPending && pending[0] && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent([pending[0].address, pending[0].city].filter(Boolean).join(', '))}`}
          target="_blank" rel="noopener noreferrer"
          className="block bg-slate-800 text-white rounded-2xl p-4 text-center font-bold transition-colors hover:bg-slate-700 active:bg-slate-900"
        >
          📍 Navegar para primeira entrega
        </a>
      )}
    </div>
  )
}
