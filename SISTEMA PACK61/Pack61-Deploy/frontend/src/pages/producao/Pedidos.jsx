import { useState, useEffect, useRef } from 'react'
import api from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const STATUS_OPTIONS = ['pendente', 'em_producao', 'produzido', 'pronto_expedicao']
const STATUS_LABELS = {
  pendente: 'Pendente',
  em_producao: 'Em Produção',
  produzido: 'Produzido',
  pronto_expedicao: 'P/ Expedição',
}
const PRIORITY_COLOR = {
  high: 'border-l-4 border-red-400',
  mid: 'border-l-4 border-yellow-400',
  low: '',
}

function elapsed(startTime) {
  if (!startTime) return null
  const diff = Date.now() - new Date(startTime).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function ElapsedTimer({ startTime }) {
  const [display, setDisplay] = useState(elapsed(startTime))
  const ref = useRef()
  useEffect(() => {
    ref.current = setInterval(() => setDisplay(elapsed(startTime)), 30000)
    return () => clearInterval(ref.current)
  }, [startTime])
  if (!display) return null
  return <span className="text-blue-600 font-semibold text-xs">⏱ {display} em produção</span>
}

export default function ProducaoPedidos() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('pendente')
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [counts, setCounts] = useState({})

  const load = async (status = '') => {
    setFetching(true)
    try {
      const all = await api.get('/production')
      const c = {}
      all.data.forEach(o => { c[o.status] = (c[o.status] || 0) + 1 })
      setCounts(c)
      const filtered = status ? all.data.filter(o => o.status === status) : all.data
      setOrders(filtered)
    } finally { setFetching(false) }
  }

  useEffect(() => { load(filter) }, [filter])

  const openOrder = (o) => { setSelected(o); setNotes(o.notes || '') }

  const handleStatus = async (newStatus) => {
    setLoading(true)
    try {
      await api.put(`/production/${selected.id}/status`, { status: newStatus, notes })
      setSelected(prev => ({ ...prev, status: newStatus }))
      await load(filter)
      // Fechar se mudou para outro status que saiu do filtro atual
      if (filter && newStatus !== filter) setSelected(null)
    } finally { setLoading(false) }
  }

  const NEXT_STATUS = {
    pendente: { next: 'em_producao', label: '⚙️ Iniciar Produção', color: 'bg-blue-500 hover:bg-blue-600' },
    em_producao: { next: 'produzido', label: '✅ Marcar como Produzido', color: 'bg-green-500 hover:bg-green-600' },
    produzido: { next: 'pronto_expedicao', label: '📦 Pronto para Expedição', color: 'bg-purple-500 hover:bg-purple-600' },
  }

  // Ordenar por urgência (delivery_date mais próximo primeiro)
  const sortedOrders = [...orders].sort((a, b) => {
    if (a.delivery_date && b.delivery_date) return new Date(a.delivery_date) - new Date(b.delivery_date)
    if (a.delivery_date) return -1
    if (b.delivery_date) return 1
    return 0
  })

  return (
    <div className="space-y-4">
      {/* Tabs de status */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-colors border whitespace-nowrap ${filter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {STATUS_LABELS[s]}
            {counts[s] > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${filter === s ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts[s]}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setFilter('')}
          className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ${!filter ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
        >
          Todos
        </button>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{sortedOrders.length} pedido(s)</p>

          {sortedOrders.map(o => {
            const daysToDelivery = o.delivery_date
              ? Math.ceil((new Date(o.delivery_date) - new Date()) / 86400000)
              : null
            const isUrgent = daysToDelivery !== null && daysToDelivery <= 1
            const isMid = daysToDelivery !== null && daysToDelivery <= 3

            return (
              <button
                key={o.id}
                onClick={() => openOrder(o)}
                className={`card p-4 w-full text-left hover:bg-slate-50 transition-colors active:bg-slate-100 ${isUrgent ? PRIORITY_COLOR.high : isMid ? PRIORITY_COLOR.mid : PRIORITY_COLOR.low}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-slate-400">#{o.order_id}</span>
                      <StatusBadge status={o.status} />
                      {isUrgent && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Urgente!</span>}
                    </div>
                    <div className="font-bold text-slate-800 truncate">{o.client_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{o.city} · {o.seller_name}</div>

                    {o.status === 'em_producao' && o.start_time && (
                      <div className="mt-1">
                        <ElapsedTimer startTime={o.start_time} />
                      </div>
                    )}

                    {o.delivery_date && (
                      <div className={`text-xs mt-1 font-semibold ${isUrgent ? 'text-red-600' : isMid ? 'text-yellow-600' : 'text-slate-400'}`}>
                        Entrega: {new Date(o.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        {daysToDelivery !== null && daysToDelivery >= 0 && ` (${daysToDelivery === 0 ? 'hoje' : `${daysToDelivery}d`})`}
                        {daysToDelivery !== null && daysToDelivery < 0 && ` (atrasado ${Math.abs(daysToDelivery)}d)`}
                      </div>
                    )}

                    <div className="mt-2 space-y-0.5">
                      {o.items?.slice(0, 3).map((item, i) => (
                        <div key={i} className="text-xs text-slate-600">
                          <span className="font-bold">{item.quantity}×</span> {item.sku_name}
                        </div>
                      ))}
                      {o.items?.length > 3 && <div className="text-xs text-slate-400">+{o.items.length - 3} item(s)...</div>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-black text-brand-600">
                      R$ {Number(o.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </div>
                    {o.operator_name && (
                      <div className="text-xs text-blue-600 mt-1 font-medium">{o.operator_name}</div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}

          {sortedOrders.length === 0 && (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-slate-400 font-medium">Nenhum pedido neste status</p>
            </div>
          )}
        </div>
      )}

      {/* Modal detalhe */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Pedido #${selected?.order_id}`}>
        {selected && (
          <div className="space-y-4">
            {/* Cliente */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="font-bold text-slate-800 text-base">{selected.client_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{selected.city}</div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StatusBadge status={selected.status} />
                {selected.start_time && selected.status === 'em_producao' && (
                  <ElapsedTimer startTime={selected.start_time} />
                )}
              </div>
              {selected.delivery_date && (
                <div className="text-xs text-slate-500 mt-1">
                  Entrega prevista: <strong>{new Date(selected.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                </div>
              )}
            </div>

            {/* Itens */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">O que produzir</p>
              <div className="space-y-2">
                {selected.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate">{item.sku_name}</div>
                      <div className="text-xs text-slate-400">{item.sku_code}</div>
                    </div>
                    <div className="text-xl font-black text-brand-600 ml-3">{item.quantity}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="label">Observações de Produção</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                className="input" rows={2}
                placeholder="Notas sobre esta produção..."
              />
            </div>

            {/* Ação principal */}
            {NEXT_STATUS[selected.status] && (
              <button
                onClick={() => handleStatus(NEXT_STATUS[selected.status].next)}
                disabled={loading}
                className={`w-full py-4 rounded-xl text-white font-black text-base transition-all ${NEXT_STATUS[selected.status].color} disabled:opacity-50`}
              >
                {loading ? 'Atualizando...' : NEXT_STATUS[selected.status].label}
              </button>
            )}

            {/* Cancelar pedido (apenas admin via orders) */}
            {selected.status === 'pendente' && (
              <p className="text-xs text-center text-slate-400">Para cancelar este pedido, acesse o módulo do Administrador.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
