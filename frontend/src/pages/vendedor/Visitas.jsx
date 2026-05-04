import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'

const today = new Date().toISOString().split('T')[0]

const CLASS_COLOR = {
  A: { bg: 'bg-green-100 text-green-700', border: 'border-green-300' },
  B: { bg: 'bg-blue-100 text-blue-700',   border: 'border-blue-300'  },
  C: { bg: 'bg-slate-100 text-slate-600', border: 'border-slate-300' },
}
const STATUS_COLOR = {
  VISITADO:   'bg-slate-100 text-slate-600',
  NEGOCIANDO: 'bg-yellow-100 text-yellow-700',
  FECHADO:    'bg-green-100 text-green-700',
  PERDIDO:    'bg-red-100 text-red-700',
  visitado:   'bg-slate-100 text-slate-600',
  negociando: 'bg-yellow-100 text-yellow-700',
  fechado:    'bg-green-100 text-green-700',
  perdido:    'bg-red-100 text-red-700',
}

function followUpStatus(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const t = new Date(today + 'T00:00:00')
  if (d < t) return 'late'
  if (d.getTime() === t.getTime()) return 'today'
  return 'future'
}

function getWeekStart() {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().split('T')[0]
}
function getMonthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

export default function Visitas() {
  const navigate = useNavigate()
  const [visits, setVisits]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [converting, setConverting] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  const buildParams = useCallback((filter) => {
    const p = {}
    if (filter === 'today')    { p.date_from = today; p.date_to = today }
    if (filter === 'week')     { p.date_from = getWeekStart(); p.date_to = today }
    if (filter === 'month')    { p.date_from = getMonthStart(); p.date_to = today }
    if (filter === 'followup') { p.followup_pending = '1' }
    if (filter === 'custom')   { if (customFrom) p.date_from = customFrom; if (customTo) p.date_to = customTo }
    return p
  }, [customFrom, customTo])

  const load = useCallback((filter = activeFilter) => {
    setLoading(true)
    api.get('/visits', { params: buildParams(filter) })
      .then(r => setVisits(r.data || []))
      .finally(() => setLoading(false))
  }, [buildParams, activeFilter])

  useEffect(() => { load(activeFilter) }, [activeFilter])

  const setFilter = (f) => { setActiveFilter(f); load(f) }

  const convertToOrder = async (v) => {
    if (!v.orcamento_items?.length) {
      navigate(`/vendedor/nova-visita`)
      return
    }
    setConverting(v.id)
    try {
      const r = await api.post('/orders', {
        client_id: v.client_id,
        visit_id: v.id,
        condicao_pagamento: 'A_VISTA',
        payment_terms: 'A_VISTA',
        items: v.orcamento_items.map(it => ({
          product_id: it.product_id,
          quantity: it.quantity,
          quantidade: it.quantity,
          unit_price: it.unit_price,
          preco_unitario: it.unit_price,
        })),
      })
      alert(`Pedido #${r.data.id} criado com sucesso!`)
      load(activeFilter)
    } catch (e) {
      alert(e.response?.data?.message || 'Erro ao converter em pedido')
    } finally { setConverting(null) }
  }

  const FILTERS = [
    { key: 'all',     label: 'Todas'    },
    { key: 'today',   label: 'Hoje'     },
    { key: 'week',    label: 'Semana'   },
    { key: 'month',   label: 'Mês'      },
    { key: 'followup',label: 'Follow-up' },
    { key: 'custom',  label: 'Período'  },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-slate-800">Minhas Visitas</h1>
        <button onClick={() => navigate('/vendedor/nova-visita')} className="btn-primary text-sm px-4 py-2">
          + Nova Visita
        </button>
      </div>

      {/* Filtros rápidos */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-1 min-w-max">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${activeFilter === f.key ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
              {f.key === 'followup' ? `📅 ${f.label}` : f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro período customizado */}
      {activeFilter === 'custom' && (
        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label">De</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input w-36" />
            </div>
            <div>
              <label className="label">Até</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input w-36" />
            </div>
            <button onClick={() => load('custom')} className="btn-primary">Filtrar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 px-1">{visits.length} visita{visits.length !== 1 ? 's' : ''}</p>

          {visits.map(v => {
            const fuStatus = followUpStatus(v.data_followup)
            const clazz    = v.classificacao_cliente || 'B'

            return (
              <div key={v.id}
                className={`card p-4 space-y-2 ${fuStatus === 'late' ? 'border-l-4 border-red-400' : fuStatus === 'today' ? 'border-l-4 border-orange-400' : ''}`}>

                {/* Cabeçalho */}
                <div className="flex items-start gap-2 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${CLASS_COLOR[clazz]?.bg || CLASS_COLOR.B.bg}`}>
                        {clazz}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{v.client_name}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {v.client_city || v.city || v.cidade}
                      {' · '}
                      {v.data_visita || v.visit_date
                        ? new Date((v.data_visita || v.visit_date) + 'T00:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[v.status_visita || v.status] || STATUS_COLOR.VISITADO}`}>
                      {(v.status_visita || v.status || 'visitado').charAt(0).toUpperCase() + (v.status_visita || v.status || 'visitado').slice(1)}
                    </span>
                    {v.took_order ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Pedido</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Sem pedido</span>
                    )}
                  </div>
                </div>

                {/* Motivo de perda */}
                {!v.took_order && v.no_order_reason && (
                  <div className="text-xs text-red-600 font-medium">
                    Motivo: {v.no_order_reason}
                  </div>
                )}

                {/* Observações */}
                {(v.observations || v.observacoes) && (
                  <p className="text-xs text-slate-500 italic">"{v.observations || v.observacoes}"</p>
                )}

                {/* Follow-up alert */}
                {v.data_followup && (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                    fuStatus === 'late'  ? 'bg-red-50 text-red-700'    :
                    fuStatus === 'today' ? 'bg-orange-50 text-orange-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    <span>{fuStatus === 'late' ? '🔴' : fuStatus === 'today' ? '🟠' : '📅'}</span>
                    <span>
                      Follow-up {fuStatus === 'late' ? 'ATRASADO' : fuStatus === 'today' ? 'HOJE' : ''}:{' '}
                      {new Date(v.data_followup + 'T00:00:00').toLocaleDateString('pt-BR')}
                      {v.motivo_followup && ` — ${v.motivo_followup}`}
                    </span>
                  </div>
                )}

                {/* Pré-orçamento */}
                {v.orcamento_total > 0 && (
                  <div className="text-xs text-brand-600 font-semibold">
                    💼 Pré-orçamento: R$ {Number(v.orcamento_total).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                    {v.orcamento_desconto > 0 && ` (${v.orcamento_desconto}% desc.)`}
                  </div>
                )}

                {/* Próxima compra */}
                {(v.next_purchase_date || v.next_contact_date) && (
                  <p className="text-xs text-brand-600 font-semibold">
                    Próxima compra:{' '}
                    {new Date(((v.next_purchase_date || v.next_contact_date)) + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                )}

                {/* Foto fachada */}
                {(v.foto_fachada_url || v.photo) && (
                  <a href={v.foto_fachada_url || `/uploads/${v.photo}`} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={v.foto_fachada_url || `/uploads/${v.photo}`} alt="Fachada"
                      className="w-full max-h-32 object-cover rounded-xl border border-slate-200" />
                  </a>
                )}

                {/* Botão converter */}
                {!v.took_order && !v.order_id && (
                  <button
                    onClick={() => convertToOrder(v)}
                    disabled={converting === v.id}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold border-2 transition-colors
                      ${v.orcamento_items?.length
                        ? 'border-brand-400 text-brand-600 bg-brand-50 hover:bg-brand-100'
                        : 'border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100'
                      } disabled:opacity-50`}>
                    {converting === v.id
                      ? 'Criando pedido...'
                      : v.orcamento_items?.length
                      ? '📦 Converter pré-orçamento em pedido'
                      : '📦 Criar pedido desta visita'}
                  </button>
                )}
              </div>
            )
          })}

          {visits.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <div className="font-semibold">Nenhuma visita encontrada</div>
              <div className="text-sm mt-1">Tente outro filtro ou registre uma nova visita</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
