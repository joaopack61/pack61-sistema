import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'

export default function MotoristaDashboard() {
  const [disponiveis, setDisponiveis] = useState([])
  const [emRota, setEmRota] = useState([])
  const [entregues, setEntregues] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [dispRes, rotaRes, entRes] = await Promise.all([
        api.get('/orders/delivery', { params: { status: 'DISPONIVEL' } }),
        api.get('/orders/delivery', { params: { status: 'EM_ROTA'    } }),
        api.get('/orders/delivery', { params: { status: 'ENTREGUE'   } }),
      ])
      setDisponiveis(dispRes.data || [])
      setEmRota(rotaRes.data || [])
      setEntregues(entRes.data || [])
    } catch (e) {
      console.error('[MotoristaDashboard] erro ao carregar:', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent"/>
    </div>
  )

  const temPendente = disponiveis.length > 0 || emRota.length > 0
  const entreguesHoje = entregues.filter(o => {
    if (!o.updated_at) return false
    const d = new Date(o.updated_at)
    const hoje = new Date()
    return d.getFullYear() === hoje.getFullYear() &&
           d.getMonth()    === hoje.getMonth()    &&
           d.getDate()     === hoje.getDate()
  })

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* ── Banner principal ─────────────────────────── */}
      <Link to="/motorista/entregas">
        <div className={`rounded-2xl p-6 text-center shadow-lg transition-all active:scale-95 ${
          emRota.length > 0    ? 'bg-blue-500 shadow-blue-500/30' :
          disponiveis.length > 0 ? 'bg-brand-500 shadow-brand-500/30' :
          'bg-green-500 shadow-green-500/20'
        }`}>
          <div className="text-5xl mb-3">
            {emRota.length > 0 ? '🚚' : disponiveis.length > 0 ? '📦' : '🎉'}
          </div>
          <div className="text-white font-black text-xl">
            {emRota.length > 0
              ? `${emRota.length} entrega${emRota.length > 1 ? 's' : ''} em rota`
              : disponiveis.length > 0
              ? `${disponiveis.length} entrega${disponiveis.length > 1 ? 's' : ''} disponível${disponiveis.length > 1 ? 'is' : ''}`
              : 'Tudo em dia!'}
          </div>
          <div className="text-white/80 text-sm mt-1">
            {temPendente ? 'Toque para gerenciar entregas' : 'Nenhuma entrega pendente'}
          </div>
        </div>
      </Link>

      {/* ── KPIs do dia ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-3xl font-black text-brand-600">{disponiveis.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Disponíveis</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-black text-blue-600">{emRota.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Em Rota</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-black text-green-600">{entreguesHoje.length}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Entregues hoje</div>
        </div>
      </div>

      {/* ── Entregas em rota agora ───────────────────── */}
      {emRota.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 text-sm">Em rota agora</h3>
            <Link to="/motorista/entregas" className="text-xs text-brand-500 font-semibold">Ver todas →</Link>
          </div>
          <div className="space-y-3">
            {emRota.slice(0, 3).map((o, i) => (
              <Link key={o.id} to="/motorista/entregas"
                className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-black flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{o.client_name || o.razao_social}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {[o.address || o.endereco, o.city || o.cidade].filter(Boolean).join(', ')}
                  </div>
                </div>
                <span className="text-blue-500 text-lg">›</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Próximas disponíveis ─────────────────────── */}
      {disponiveis.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 text-sm">Disponíveis para aceitar</h3>
            <Link to="/motorista/entregas" className="text-xs text-brand-500 font-semibold">Ver todas →</Link>
          </div>
          <div className="space-y-3">
            {disponiveis.slice(0, 3).map((o, i) => (
              <Link key={o.id} to="/motorista/entregas"
                className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${i === 0 ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{o.client_name || o.razao_social}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {[o.address || o.endereco, o.city || o.cidade].filter(Boolean).join(', ')}
                  </div>
                </div>
                <span className="text-brand-500 text-lg">›</span>
              </Link>
            ))}
            {disponiveis.length > 3 && (
              <Link to="/motorista/entregas" className="block text-center text-xs text-slate-400 pt-1">
                + {disponiveis.length - 3} entrega(s) disponível(is)
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Navegar para primeira entrega ───────────── */}
      {emRota.length > 0 && emRota[0] && (() => {
        const o = emRota[0]
        const addr = [o.address || o.endereco, o.city || o.cidade].filter(Boolean).join(', ')
        return addr ? (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
            target="_blank" rel="noopener noreferrer"
            className="block bg-slate-800 text-white rounded-2xl p-4 text-center font-bold hover:bg-slate-700 active:bg-slate-900 transition-colors">
            📍 Navegar para entrega em rota
          </a>
        ) : null
      })()}

      {/* ── Histórico do dia ─────────────────────────── */}
      {entreguesHoje.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Entregues hoje ({entreguesHoje.length})</h3>
          <div className="space-y-2">
            {entreguesHoje.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-green-500 text-lg flex-shrink-0">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate">{o.client_name || o.razao_social}</div>
                  <div className="text-xs text-slate-400">
                    {o.updated_at ? new Date(o.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sem nada pendente ───────────────────────── */}
      {!temPendente && entreguesHoje.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <div className="font-bold text-slate-700">Nenhuma entrega no momento</div>
          <div className="text-sm text-slate-400 mt-1">Quando um pedido estiver pronto para expedição, ele aparecerá aqui.</div>
        </div>
      )}

    </div>
  )
}
