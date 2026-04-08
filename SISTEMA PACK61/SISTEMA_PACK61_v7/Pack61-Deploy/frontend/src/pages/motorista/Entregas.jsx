import { useState, useEffect } from 'react'
import api from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const STATUS_FLOW = [
  { key: 'saiu_entrega', label: 'Saí para Entrega', emoji: '🚗', color: 'bg-orange-500 active:bg-orange-600' },
  { key: 'chegou_cliente', label: 'Cheguei no Cliente', emoji: '📍', color: 'bg-blue-500 active:bg-blue-600' },
  { key: 'entregue', label: 'Entrega Confirmada ✓', emoji: '✅', color: 'bg-green-500 active:bg-green-600' },
  { key: 'nao_entregue', label: 'Não Consegui Entregar', emoji: '❌', color: 'bg-slate-500 active:bg-slate-600' },
  { key: 'ocorrencia', label: 'Registrar Ocorrência', emoji: '⚠️', color: 'bg-yellow-500 active:bg-yellow-600' },
]

export default function Entregas() {
  const [deliveries, setDeliveries] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [files, setFiles] = useState({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [tab, setTab] = useState('pendentes')

  const load = () => {
    setFetching(true)
    api.get('/deliveries').then(r => setDeliveries(r.data)).finally(() => setFetching(false))
  }
  useEffect(() => { load() }, [])

  const openDelivery = async (d) => {
    const r = await api.get(`/deliveries/${d.id}`)
    setSelected(r.data)
    setForm({
      status: r.data.status,
      observations: r.data.observations || '',
      occurrence: r.data.occurrence || '',
      no_delivery_reason: r.data.no_delivery_reason || '',
      tubes_collected: Boolean(r.data.tubes_collected),
      tubes_quantity: r.data.tubes_quantity || '',
    })
    setFiles({})
  }

  const handleUpdate = async (newStatus) => {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('status', newStatus)
      if (form.observations) fd.append('observations', form.observations)
      if (newStatus === 'ocorrencia') fd.append('occurrence', form.occurrence || '')
      if (newStatus === 'nao_entregue') fd.append('no_delivery_reason', form.no_delivery_reason || '')
      fd.append('tubes_collected', form.tubes_collected ? 1 : 0)
      if (form.tubes_collected && form.tubes_quantity) fd.append('tubes_quantity', form.tubes_quantity)
      if (files.canhoto_photo) fd.append('canhoto_photo', files.canhoto_photo)
      if (files.delivery_photo) fd.append('delivery_photo', files.delivery_photo)

      await api.put(`/deliveries/${selected.id}/status`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
      setSelected(null)
    } finally { setLoading(false) }
  }

  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const activeStatuses = ['pendente', 'saiu_entrega', 'chegou_cliente']
  const pendentes = deliveries.filter(d => activeStatuses.includes(d.status))
  const concluidas = deliveries.filter(d => !activeStatuses.includes(d.status))

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        <button onClick={() => setTab('pendentes')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'pendentes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          Pendentes {pendentes.length > 0 && <span className="ml-1 bg-brand-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendentes.length}</span>}
        </button>
        <button onClick={() => setTab('concluidas')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'concluidas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          Concluídas ({concluidas.length})
        </button>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/>
        </div>
      ) : (
        <>
          {tab === 'pendentes' && (
            <div className="space-y-3">
              {pendentes.length === 0 ? (
                <div className="card p-10 text-center">
                  <div className="text-5xl mb-3">🎉</div>
                  <p className="font-bold text-slate-700">Nenhuma entrega pendente!</p>
                  <p className="text-sm text-slate-400 mt-1">Todas as entregas foram concluídas.</p>
                </div>
              ) : pendentes.map(d => (
                <button key={d.id} onClick={() => openDelivery(d)} className="card p-4 w-full text-left active:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-base">{d.client_name}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{d.address}</div>
                      <div className="text-sm text-brand-600 font-semibold mt-0.5">{d.city}</div>
                      {d.phone && <div className="text-xs text-slate-400 mt-1">📞 {d.phone}</div>}
                      {d.items?.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500">
                          {d.items.slice(0, 2).map((it, i) => <div key={i}>{it.quantity}x {it.sku_name}</div>)}
                          {d.items.length > 2 && <div>+{d.items.length - 2} item(s)...</div>}
                        </div>
                      )}
                      <div className="mt-2"><StatusBadge status={d.status} /></div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      <span className="text-brand-500 text-2xl">›</span>
                      {d.vehicle_plate && <span className="text-xs text-slate-400">{d.vehicle_plate}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === 'concluidas' && (
            <div className="space-y-2">
              {concluidas.map(d => (
                <button key={d.id} onClick={() => openDelivery(d)} className="card p-4 w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 truncate">{d.client_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{d.city}</div>
                      {d.completion_time && (
                        <div className="text-xs text-slate-400">{new Date(d.completion_time).toLocaleString('pt-BR')}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusBadge status={d.status} />
                      {d.canhoto_photo && <span className="text-xs text-green-600 font-bold">📄 OK</span>}
                    </div>
                  </div>
                </button>
              ))}
              {concluidas.length === 0 && <div className="text-center py-8 text-slate-400">Nenhuma entrega concluída</div>}
            </div>
          )}
        </>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Atualizar Entrega">
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="font-bold text-slate-800 text-base">{selected.client_name}</div>
              <div className="text-sm text-slate-600 mt-0.5">{selected.address}, {selected.city}</div>
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1 text-brand-500 font-semibold text-sm mt-2">
                  📞 {selected.phone}
                </a>
              )}
            </div>

            {selected.items?.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Itens para entregar</p>
                <div className="space-y-1">
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.sku_name}</span>
                      <span className="font-bold text-slate-800">{item.quantity} {item.unit || 'un'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">Observações</label>
              <textarea value={form.observations} onChange={e => F('observations', e.target.value)} className="input" rows={2} placeholder="Informações adicionais..." />
            </div>

            <div>
              <label className="label">Foto do Canhoto Assinado</label>
              <input
                type="file" accept="image/*" capture="environment"
                onChange={e => setFiles(p => ({ ...p, canhoto_photo: e.target.files[0] }))}
                className="input text-sm"
              />
              {selected.canhoto_photo && (
                <a href={`/uploads/${selected.canhoto_photo}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-green-600 font-semibold mt-1 block">
                  📄 Ver canhoto já enviado
                </a>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox" id="tubes" checked={form.tubes_collected}
                  onChange={e => F('tubes_collected', e.target.checked)}
                  className="w-5 h-5 accent-brand-500"
                />
                <label htmlFor="tubes" className="text-sm font-semibold text-slate-700">
                  Recolheu tubos vazios?
                </label>
              </div>
              {form.tubes_collected && (
                <div>
                  <label className="label">Quantidade de tubos</label>
                  <input type="number" value={form.tubes_quantity} onChange={e => F('tubes_quantity', e.target.value)} className="input" min="1" placeholder="Ex: 5" />
                </div>
              )}
            </div>

            {(form.status === 'ocorrencia') && (
              <div>
                <label className="label">Descreva a ocorrência</label>
                <textarea value={form.occurrence} onChange={e => F('occurrence', e.target.value)} className="input" rows={2} />
              </div>
            )}
            {(form.status === 'nao_entregue') && (
              <div>
                <label className="label">Motivo de não entrega</label>
                <input value={form.no_delivery_reason} onChange={e => F('no_delivery_reason', e.target.value)} className="input" placeholder="Ex: Cliente ausente" />
              </div>
            )}

            <div className="space-y-2 pt-1">
              {STATUS_FLOW.map(s => {
                const isCurrent = selected.status === s.key
                return (
                  <button
                    key={s.key}
                    onClick={() => { F('status', s.key); handleUpdate(s.key) }}
                    disabled={loading || isCurrent}
                    className={`w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all ${s.color} disabled:opacity-40 flex items-center justify-center gap-2`}
                  >
                    {isCurrent ? (
                      <span className="flex items-center gap-2"><span className="text-white/80">✓ Status atual:</span> {s.label}</span>
                    ) : (
                      <span className="flex items-center gap-2">{s.emoji} {s.label}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
