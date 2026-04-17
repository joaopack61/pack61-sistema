import { useState, useEffect } from 'react'
import api from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const STATUS_OPTIONS = ['pendente', 'em_producao', 'produzido', 'pronto_expedicao', 'entregue', 'cancelado']
const STATUS_LABELS = {
  pendente: 'Pendente',
  em_producao: 'Em Produção',
  produzido: 'Produzido',
  pronto_expedicao: 'P/ Expedição',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}
const PAYMENT_STATUS = ['pendente', 'faturado', 'pago', 'vencido', 'cancelado']

const FLOW = ['pendente', 'em_producao', 'produzido', 'pronto_expedicao', 'entregue']

function FlowStepper({ current }) {
  const idx = FLOW.indexOf(current)
  return (
    <div className="flex items-center gap-0.5 mt-3">
      {FLOW.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div
            className={`h-1.5 flex-1 rounded-full transition-all ${i <= idx ? 'bg-brand-500' : 'bg-slate-200'}`}
          />
        </div>
      ))}
    </div>
  )
}

const emptyNewOrder = {
  client_id: '',
  seller_id: '',
  delivery_date: '',
  payment_terms: '',
  notes: '',
  items: [{ sku_id: '', quantity: 1, unit_price: '' }],
}

export default function AdminPedidos() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)
  const [search, setSearch] = useState('')

  // Novo pedido
  const [showNew, setShowNew] = useState(false)
  const [newOrder, setNewOrder] = useState(emptyNewOrder)
  const [clients, setClients] = useState([])
  const [sellers, setSellers] = useState([])
  const [products, setProducts] = useState([])
  const [newLoading, setNewLoading] = useState(false)
  const [newError, setNewError] = useState('')

  const load = (status = '') => {
    setLoading(true)
    api.get('/orders', { params: status ? { status } : {} })
      .then(r => setOrders(r.data))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openNewModal = async () => {
    setNewOrder(emptyNewOrder)
    setNewError('')
    setShowNew(true)
    try {
      const [cliRes, usersRes, prodRes] = await Promise.all([
        api.get('/clients'),
        api.get('/users'),
        api.get('/products'),
      ])
      setClients(cliRes.data)
      setSellers(usersRes.data.filter(u => u.role === 'vendedor' && u.active))
      setProducts(prodRes.data)
    } catch {}
  }

  const handleStatus = async (orderId, status) => {
    setChanging(true)
    try {
      await api.put(`/orders/${orderId}/status`, { status })
      await load(filter)
      if (selected?.id === orderId) setSelected(prev => ({ ...prev, status }))
    } finally { setChanging(false) }
  }

  const handlePayment = async (orderId, payment_status) => {
    setChanging(true)
    try {
      await api.put(`/orders/${orderId}/payment`, { payment_status })
      await load(filter)
      if (selected?.id === orderId) setSelected(prev => ({ ...prev, payment_status }))
    } finally { setChanging(false) }
  }

  const openOrder = async (o) => {
    const r = await api.get(`/orders/${o.id}`)
    setSelected(r.data)
  }

  // Novo pedido — manipulação de itens
  const setItem = (i, field, val) => {
    setNewOrder(prev => {
      const items = [...prev.items]
      items[i] = { ...items[i], [field]: val }
      return { ...prev, items }
    })
  }
  const addItem = () => setNewOrder(prev => ({ ...prev, items: [...prev.items, { sku_id: '', quantity: 1, unit_price: '' }] }))
  const removeItem = (i) => setNewOrder(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }))

  const orderTotal = newOrder.items.reduce((acc, it) => {
    const qty = parseFloat(it.quantity) || 0
    const price = parseFloat(it.unit_price) || 0
    return acc + qty * price
  }, 0)

  const handleCreateOrder = async () => {
    if (!newOrder.client_id) { setNewError('Selecione um cliente'); return }
    if (!newOrder.items.length || !newOrder.items[0].sku_id) { setNewError('Adicione pelo menos 1 item'); return }
    setNewLoading(true); setNewError('')
    try {
      const payload = {
        client_id: parseInt(newOrder.client_id),
        seller_id: newOrder.seller_id ? parseInt(newOrder.seller_id) : undefined,
        delivery_date: newOrder.delivery_date || undefined,
        payment_terms: newOrder.payment_terms || undefined,
        notes: newOrder.notes || undefined,
        items: newOrder.items
          .filter(it => it.sku_id)
          .map(it => ({
            sku_id: parseInt(it.sku_id),
            quantity: parseFloat(it.quantity) || 1,
            unit_price: parseFloat(it.unit_price) || 0,
          })),
      }
      await api.post('/orders', payload)
      setShowNew(false)
      await load(filter)
    } catch (e) {
      setNewError(e.response?.data?.error || 'Erro ao criar pedido')
    } finally { setNewLoading(false) }
  }

  const displayed = orders.filter(o =>
    !search || o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    String(o.id).includes(search) ||
    o.seller_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Filtros de status + Novo Pedido */}
      <div className="flex gap-2 items-center">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
          <button
            onClick={() => { setFilter(''); load('') }}
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 border transition-colors ${!filter ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            Todos ({orders.length})
          </button>
          {STATUS_OPTIONS.map(s => {
            const count = orders.filter(o => o.status === s).length
            return (
              <button
                key={s}
                onClick={() => { setFilter(s); load(s) }}
                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 border transition-colors ${filter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {STATUS_LABELS[s]} {count > 0 ? `(${count})` : ''}
              </button>
            )
          })}
        </div>
        <button
          onClick={openNewModal}
          className="btn-primary text-xs flex-shrink-0 whitespace-nowrap"
        >
          + Novo Pedido
        </button>
      </div>

      {/* Busca */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        className="input" placeholder="Buscar por cliente, ID ou vendedor..."
      />

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{displayed.length} pedido(s)</p>
          {displayed.map(o => (
            <button
              key={o.id}
              onClick={() => openOrder(o)}
              className="card p-4 w-full text-left hover:bg-slate-50 transition-colors active:bg-slate-100"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400">#{o.id}</span>
                    <StatusBadge status={o.status} />
                    {o.payment_status && o.payment_status !== 'pendente' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        o.payment_status === 'pago' ? 'bg-green-100 text-green-700' :
                        o.payment_status === 'vencido' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {o.payment_status}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-800 mt-1 truncate">{o.client_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {o.city} · {o.seller_name}
                    {o.delivery_date && ` · Entrega: ${new Date(o.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                  </div>
                  {o.items?.length > 0 && (
                    <div className="mt-1.5 text-xs text-slate-500">
                      {o.items.slice(0, 2).map((it, i) => <span key={i} className="mr-2">{it.quantity}× {it.sku_name}</span>)}
                      {o.items.length > 2 && <span className="text-slate-400">+{o.items.length - 2}</span>}
                    </div>
                  )}
                  {!['cancelado', 'entregue'].includes(o.status) && <FlowStepper current={o.status} />}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm font-black text-brand-600">
                    R$ {Number(o.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(o.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {displayed.length === 0 && <div className="text-center py-10 text-slate-400">Nenhum pedido encontrado</div>}
        </div>
      )}

      {/* Modal detalhe */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Pedido #${selected?.id}`}>
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
              <div className="font-bold text-slate-800 text-base">{selected.client_name}</div>
              {selected.city && <div className="text-xs text-slate-500">{selected.address ? `${selected.address}, ` : ''}{selected.city}</div>}
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="text-xs text-brand-500 font-semibold">📞 {selected.phone}</a>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-slate-500">Vendedor: <strong>{selected.seller_name}</strong></span>
                {selected.payment_terms && <span className="text-xs text-slate-500">Pagamento: <strong>{selected.payment_terms}</strong></span>}
                {selected.delivery_date && <span className="text-xs text-slate-500">Entrega: <strong>{new Date(selected.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Itens do Pedido</p>
              <div className="space-y-1 bg-slate-50 rounded-xl p-3">
                {selected.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-700 flex-1 truncate">{item.sku_name}</span>
                    <span className="text-xs text-slate-500 ml-2 whitespace-nowrap">
                      {item.quantity}× R${Number(item.unit_price || 0).toFixed(2)}
                      {' = '}<strong>R${Number(item.total_price || 0).toFixed(2)}</strong>
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 font-black text-brand-600">
                  <span>Total</span>
                  <span>R$ {Number(selected.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {selected.notes && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 italic">"{selected.notes}"</div>
            )}

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Status do Pedido</p>
              <div className="grid grid-cols-3 gap-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatus(selected.id, s)}
                    disabled={changing || selected.status === s}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
                      selected.status === s
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    } disabled:opacity-50`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Status Financeiro</p>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_STATUS.map(s => (
                  <button
                    key={s}
                    onClick={() => handlePayment(selected.id, s)}
                    disabled={changing || selected.payment_status === s}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      selected.payment_status === s
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    } disabled:opacity-50`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Novo Pedido */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Novo Pedido">
        <div className="space-y-4">
          <div>
            <label className="label">Cliente *</label>
            <select value={newOrder.client_id} onChange={e => setNewOrder(p => ({...p, client_id: e.target.value}))} className="input">
              <option value="">Selecione o cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Vendedor responsável</label>
            <select value={newOrder.seller_id} onChange={e => setNewOrder(p => ({...p, seller_id: e.target.value}))} className="input">
              <option value="">Selecione o vendedor...</option>
              {sellers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data de entrega</label>
              <input type="date" value={newOrder.delivery_date} onChange={e => setNewOrder(p => ({...p, delivery_date: e.target.value}))} className="input" />
            </div>
            <div>
              <label className="label">Cond. pagamento</label>
              <input type="text" value={newOrder.payment_terms} onChange={e => setNewOrder(p => ({...p, payment_terms: e.target.value}))} className="input" placeholder="Ex: 30/60 dias" />
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea value={newOrder.notes} onChange={e => setNewOrder(p => ({...p, notes: e.target.value}))} className="input" rows={2} placeholder="Opcional..." />
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase">Itens do Pedido</p>
              <button type="button" onClick={addItem} className="text-xs text-brand-600 font-bold hover:text-brand-700">+ Adicionar item</button>
            </div>
            <div className="space-y-2">
              {newOrder.items.map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Item {i + 1}</span>
                    {newOrder.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-500 font-bold">Remover</button>
                    )}
                  </div>
                  <select
                    value={item.product_id || item.sku_id || ''}
                    onChange={e => {
                      const prod = products.find(p => String(p.id) === e.target.value)
                      setItem(i, 'product_id', e.target.value)
                      setItem(i, 'sku_id', e.target.value)
                      if (prod) setItem(i, 'unit_price', prod.preco_unitario || prod.unit_price || '')
                    }}
                    className="input text-sm">
                    <option value="">Selecione o produto...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome || p.name}
                        {p.tipo ? ` · ${p.tipo}` : ''}
                        {p.gramatura ? ` · ${p.gramatura}g` : ''}
                        {p.metragem ? ` · ${p.metragem}m` : ''}
                        {` — R$ ${parseFloat(p.preco_unitario || p.unit_price || 0).toFixed(2)}`}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label">Qtd</label>
                      <input type="number" min="1" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className="label">Preço unit.</label>
                      <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} className="input" placeholder="0,00" />
                    </div>
                    <div>
                      <label className="label">Total</label>
                      <div className="input bg-slate-100 text-slate-600 font-semibold text-sm flex items-center">
                        R$ {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm font-black text-brand-600">
              Total do pedido: R$ {orderTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {newError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{newError}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleCreateOrder} disabled={newLoading} className="btn-primary flex-1">
              {newLoading ? 'Salvando...' : '💾 Criar Pedido'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
