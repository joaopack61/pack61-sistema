import { useState, useEffect } from 'react'
import api from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

export default function AdminLogistica() {
  const [tab, setTab] = useState('expedicao')
  const [readyOrders, setReadyOrders] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [drivers, setDrivers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ driver_id: '', vehicle_id: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [delModal, setDelModal] = useState(null)

  const loadAll = async () => {
    const [ordersRes, delivRes, usersRes, vehiclesRes] = await Promise.all([
      api.get('/orders', { params: { status: 'pronto_expedicao' } }),
      api.get('/deliveries'),
      api.get('/users'),
      api.get('/deliveries/vehicles/list'),
    ])
    setReadyOrders(ordersRes.data)
    setDeliveries(delivRes.data)
    setDrivers(usersRes.data.filter(u => u.role === 'motorista' && u.active))
    setVehicles(vehiclesRes.data)
  }

  useEffect(() => { loadAll() }, [])

  const openAssign = (order) => {
    setSelected(order)
    setForm({ driver_id: '', vehicle_id: '' })
    setError('')
  }

  const handleAssign = async () => {
    if (!form.driver_id) { setError('Selecione um motorista'); return }
    setLoading(true); setError('')
    try {
      await api.post('/deliveries', {
        order_id: selected.id,
        driver_id: parseInt(form.driver_id),
        vehicle_id: form.vehicle_id ? parseInt(form.vehicle_id) : undefined,
      })
      await loadAll()
      setSelected(null)
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao criar entrega')
    } finally { setLoading(false) }
  }

  const inTransit = deliveries.filter(d => ['pendente','saiu_entrega','chegou_cliente'].includes(d.status))
  const completed = deliveries.filter(d => ['entregue','nao_entregue','ocorrencia'].includes(d.status))

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full">
        {[
          { key: 'expedicao', label: `Pronto p/ Exp. (${readyOrders.length})` },
          { key: 'em_rota', label: `Em Rota (${inTransit.length})` },
          { key: 'historico', label: `Histórico (${completed.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'expedicao' && (
        <div className="space-y-2">
          {readyOrders.length === 0 && (
            <div className="card p-10 text-center text-slate-400">
              <div className="text-4xl mb-2">📦</div>
              <p className="font-medium">Nenhum pedido pronto para expedição</p>
            </div>
          )}
          {readyOrders.map(o => (
            <div key={o.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400">Pedido #{o.id}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="font-bold text-slate-800">{o.client_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{o.city}</div>
                  <div className="text-sm font-semibold text-brand-600 mt-1">
                    R$ {Number(o.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  {o.items?.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {o.items.slice(0, 3).map((item, i) => (
                        <div key={i} className="text-xs text-slate-500">{item.quantity}x {item.sku_name}</div>
                      ))}
                      {o.items.length > 3 && <div className="text-xs text-slate-400">+{o.items.length - 3} item(s)...</div>}
                    </div>
                  )}
                </div>
                <button onClick={() => openAssign(o)} className="btn-primary text-xs flex-shrink-0 whitespace-nowrap">
                  🚚 Enviar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'em_rota' && (
        <div className="space-y-2">
          {inTransit.length === 0 && (
            <div className="card p-10 text-center text-slate-400">
              <div className="text-4xl mb-2">🚚</div>
              <p className="font-medium">Nenhuma entrega em rota agora</p>
            </div>
          )}
          {inTransit.map(d => (
            <button key={d.id} onClick={() => setDelModal(d)} className="card p-4 w-full text-left hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 truncate">{d.client_name}</div>
                  <div className="text-xs text-slate-500 truncate">{d.address}, {d.city}</div>
                  <div className="text-xs text-slate-400 mt-1">Motorista: {d.driver_name} · {d.plate || 'Veículo não informado'}</div>
                  <div className="mt-2"><StatusBadge status={d.status} /></div>
                </div>
                <span className="text-brand-500 text-lg">›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'historico' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{completed.length} entrega(s) finalizadas</p>
          {completed.map(d => (
            <button key={d.id} onClick={() => setDelModal(d)} className="card p-4 w-full text-left hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{d.client_name}</div>
                  <div className="text-xs text-slate-500">{d.driver_name} · {d.city}</div>
                  {d.completion_time && (
                    <div className="text-xs text-slate-400 mt-0.5">{new Date(d.completion_time).toLocaleString('pt-BR')}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={d.status} />
                  {d.canhoto_photo && <span className="text-xs text-green-600 font-semibold">📄 Canhoto</span>}
                  {d.tubes_collected ? <span className="text-xs text-blue-600 font-semibold">🔄 {d.tubes_quantity} tubos</span> : null}
                </div>
              </div>
            </button>
          ))}
          {completed.length === 0 && <div className="text-center py-8 text-slate-400">Nenhuma entrega finalizada</div>}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Enviar Pedido #${selected?.id}`}>
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="font-bold text-slate-800">{selected.client_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{selected.address}, {selected.city}</div>
              {selected.items?.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {selected.items.map((item, i) => (
                    <div key={i} className="text-xs text-slate-600">{item.quantity}x {item.sku_name}</div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="label">Motorista *</label>
              <select value={form.driver_id} onChange={e => setForm(p => ({...p, driver_id: e.target.value}))} className="input">
                <option value="">Selecione o motorista...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Veículo</label>
              <select value={form.vehicle_id} onChange={e => setForm(p => ({...p, vehicle_id: e.target.value}))} className="input">
                <option value="">Selecione o veículo (opcional)</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
              </select>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleAssign} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Enviando...' : '🚚 Confirmar Envio'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)} title="Detalhes da Entrega">
        {delModal && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-500 text-xs block">Cliente</span><span className="font-semibold">{delModal.client_name}</span></div>
              <div><span className="text-slate-500 text-xs block">Motorista</span><span className="font-semibold">{delModal.driver_name}</span></div>
              <div><span className="text-slate-500 text-xs block">Veículo</span><span className="font-semibold">{delModal.plate || '—'}</span></div>
              <div><span className="text-slate-500 text-xs block">Status</span><StatusBadge status={delModal.status} /></div>
              {delModal.departure_time && <div><span className="text-slate-500 text-xs block">Saída</span><span>{new Date(delModal.departure_time).toLocaleTimeString('pt-BR')}</span></div>}
              {delModal.completion_time && <div><span className="text-slate-500 text-xs block">Conclusão</span><span>{new Date(delModal.completion_time).toLocaleTimeString('pt-BR')}</span></div>}
            </div>
            {delModal.observations && <div className="bg-slate-50 rounded-lg p-2 text-xs text-slate-600">{delModal.observations}</div>}
            {delModal.occurrence && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800"><strong>Ocorrência:</strong> {delModal.occurrence}</div>}
            <div className="flex gap-3 flex-wrap">
              {delModal.tubes_collected ? <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">🔄 {delModal.tubes_quantity} tubos recolhidos</span> : null}
              {delModal.canhoto_photo ? (
                <a href={`/uploads/${delModal.canhoto_photo}`} target="_blank" rel="noopener noreferrer" className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-semibold">📄 Ver canhoto</a>
              ) : <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1 rounded-full">Sem canhoto</span>}
            </div>
            {delModal.items?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Itens entregues</p>
                {delModal.items.map((item, i) => <div key={i} className="text-xs text-slate-700">{item.quantity}x {item.sku_name}</div>)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
