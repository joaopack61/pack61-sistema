import { useState, useEffect } from 'react'
import api from '../../api'
import Modal from '../../components/Modal'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const CLASS_COLOR = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-slate-100 text-slate-600',
}
const STATUS_COLOR = {
  VISITADO:   'bg-slate-100 text-slate-600',
  NEGOCIANDO: 'bg-yellow-100 text-yellow-700',
  FECHADO:    'bg-green-100 text-green-700',
  PERDIDO:    'bg-red-100 text-red-700',
}

function photoSrc(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

function fmt(v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 }) }
function fmtR(v) { return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }

export default function AdminVendedores() {
  const [sellers, setSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)        // { seller, stats, visits }
  const [detailLoading, setDetailLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [searchVisit, setSearchVisit] = useState('')

  useEffect(() => {
    api.get('/sellers')
      .then(r => setSellers(r.data))
      .finally(() => setLoading(false))
  }, [])

  const openDetail = async (seller) => {
    setDetailLoading(true)
    setSelected(null)
    try {
      const r = await api.get(`/sellers/${seller.id}`)
      setSelected(r.data)
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredVisits = selected?.visits?.filter(v => {
    if (!searchVisit) return true
    const q = searchVisit.toLowerCase()
    return (
      (v.client_name || '').toLowerCase().includes(q) ||
      (v.cnpj || v.client_cnpj || '').includes(q) ||
      (v.status_visita || '').toLowerCase().includes(q)
    )
  }) || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800">Vendedores</h1>
          <p className="text-xs text-slate-400 mt-0.5">Performance e visitas por vendedor — mês atual</p>
        </div>
      </div>

      {/* ── Lista de vendedores ─────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/>
        </div>
      ) : (
        <div className="space-y-2">
          {sellers.length === 0 && (
            <div className="card p-8 text-center text-slate-400 text-sm">Nenhum vendedor cadastrado</div>
          )}
          {sellers.map(s => (
            <button
              key={s.id}
              onClick={() => openDetail(s)}
              className="card p-4 w-full text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-black text-lg flex-shrink-0">
                  {s.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 truncate">{s.name}</div>
                  <div className="text-xs text-slate-500 truncate">{s.email}</div>
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <div className="text-xs font-bold text-brand-600">{fmtR(s.volume_mes)}</div>
                  <div className="text-xs text-slate-400">{fmt(s.visitas_mes)} visitas · {fmt(s.pedidos_mes)} pedidos</div>
                </div>
                <span className="text-slate-400 text-lg">›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Loader de detalhe ───────────────────────────────────── */}
      {detailLoading && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent"/>
        </div>
      )}

      {/* ── Modal detalhe vendedor ──────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setSearchVisit('') }}
        title={selected ? `Vendedor — ${selected.seller.name}` : ''}
      >
        {selected && (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Hoje',    value: selected.stats.visitas_hoje },
                { label: 'Semana',  value: selected.stats.visitas_semana },
                { label: 'Mês',     value: selected.stats.visitas_mes },
              ].map(k => (
                <div key={k.label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-brand-600">{fmt(k.value)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Contato */}
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Dados do vendedor</div>
              <div className="text-slate-700">{selected.seller.email}</div>
              {selected.seller.phone && <div className="text-slate-600">{selected.seller.phone}</div>}
            </div>

            {/* Busca nas visitas */}
            <input
              value={searchVisit}
              onChange={e => setSearchVisit(e.target.value)}
              className="input"
              placeholder="Buscar visita por cliente, CNPJ ou status..."
            />

            {/* Lista de visitas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase">
                  Visitas ({filteredVisits.length})
                </p>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {filteredVisits.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-4">Nenhuma visita encontrada</p>
                )}
                {filteredVisits.map(v => (
                  <div key={v.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-sm truncate">
                          {v.client_name || '—'}
                        </div>
                        {(v.cnpj || v.client_cnpj) && (
                          <div className="text-xs text-slate-400">CNPJ: {v.cnpj || v.client_cnpj}</div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {v.classificacao_cliente && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CLASS_COLOR[v.classificacao_cliente] || CLASS_COLOR.B}`}>
                            {v.classificacao_cliente}
                          </span>
                        )}
                        {v.status_visita && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[v.status_visita] || STATUS_COLOR.VISITADO}`}>
                            {v.status_visita}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        {v.data_visita || v.visit_date
                          ? new Date((v.data_visita || v.visit_date) + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '—'}
                      </span>
                      <span>
                        Orçamento: {v.gerou_orcamento
                          ? `Sim${v.valor_orcamento ? ` — ${fmtR(v.valor_orcamento)}` : ''}`
                          : 'Não'}
                      </span>
                    </div>

                    {/* Contato */}
                    {(v.contato_atendeu || v.telefone_contato) && (
                      <div className="text-xs text-slate-500">
                        Contato: <strong>{v.contato_atendeu}</strong>
                        {v.telefone_contato && ` — ${v.telefone_contato}`}
                      </div>
                    )}

                    {/* Observações */}
                    {(v.observacoes || v.notes) && (
                      <div className="text-xs text-slate-500 italic">
                        "{v.observacoes || v.notes}"
                      </div>
                    )}

                    {/* Foto fachada */}
                    {v.foto_fachada_url && (
                      <button
                        onClick={() => setLightbox(photoSrc(v.foto_fachada_url))}
                        className="block"
                      >
                        <img
                          src={photoSrc(v.foto_fachada_url)}
                          alt="Fachada"
                          className="w-full max-h-32 object-cover rounded-lg border border-slate-200"
                        />
                        <div className="text-xs text-brand-500 mt-1 font-semibold">Ampliar foto →</div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} className="max-w-full max-h-full object-contain rounded-xl" alt="Fachada" />
          <button className="absolute top-4 right-4 text-white text-3xl font-bold leading-none">✕</button>
        </div>
      )}
    </div>
  )
}
