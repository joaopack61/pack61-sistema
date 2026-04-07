import { useState, useEffect, useRef } from 'react'
import api from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

// Indicador de canhoto para uso nas listas
function CanhotoTag({ d }) {
  const hasPhoto = d.canhoto_photo || d.canhoto_count > 0
  if (d.status === 'entregue' && hasPhoto)
    return <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">📄 OK</span>
  if (d.status === 'entregue' && !hasPhoto)
    return <span className="text-xs bg-yellow-50 text-yellow-700 font-bold px-2 py-0.5 rounded-full">📄 sem foto</span>
  return null
}

function TubeTag({ d }) {
  if (d.tubes_pending)
    return <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">⚠ tubo pendente</span>
  if (d.tubes_had && d.tubes_quantity > 0)
    return <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">🔄 {d.tubes_quantity} tubos</span>
  return null
}

// Seção colapsável
function Section({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-left"
      >
        <span className="font-bold text-slate-700 text-sm">{icon} {title}</span>
        <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}

// Mini-modal de justificativa (sem canhoto)
function JustModal({ open, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (open) setReason('') }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
        <div className="text-center">
          <div className="text-3xl mb-2">📋</div>
          <p className="font-bold text-slate-800">Entrega sem comprovante</p>
          <p className="text-sm text-slate-500 mt-1">Informe o motivo para concluir sem canhoto.</p>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="input w-full"
          rows={3}
          placeholder="Ex: Cliente assinou digitalmente, canhoto enviado por e-mail..."
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Entregas() {
  const [deliveries, setDeliveries] = useState([])
  const [selected, setSelected]     = useState(null)
  const [form, setForm]             = useState({})
  const [newPhotos, setNewPhotos]   = useState([])   // File[]
  const [previews, setPreviews]     = useState([])   // blob URLs
  const [loading, setLoading]       = useState(false)
  const [fetching, setFetching]     = useState(true)
  const [tab, setTab]               = useState('pendentes')
  const [justOpen, setJustOpen]     = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const fileRef = useRef()

  const load = () => {
    setFetching(true)
    api.get('/deliveries').then(r => setDeliveries(r.data)).finally(() => setFetching(false))
  }
  useEffect(() => { load() }, [])

  const openDelivery = async (d) => {
    const r = await api.get(`/deliveries/${d.id}`)
    setSelected(r.data)
    setForm({
      observations:      r.data.observations      || '',
      occurrence:        r.data.occurrence        || '',
      no_delivery_reason: r.data.no_delivery_reason || '',
      tubes_had:         !!r.data.tubes_had,
      tubes_collected:   !!r.data.tubes_collected,
      tubes_quantity:    r.data.tubes_quantity    || '',
      tubes_pending:     !!r.data.tubes_pending,
      tubes_pending_qty: r.data.tubes_pending_qty || '',
      tubes_obs:         r.data.tubes_obs         || '',
    })
    setNewPhotos([])
    setPreviews([])
  }

  const handlePhotos = (files) => {
    const arr = Array.from(files)
    setNewPhotos(arr)
    setPreviews(arr.map(f => URL.createObjectURL(f)))
  }

  const removePhoto = (i) => {
    setNewPhotos(p => p.filter((_, idx) => idx !== i))
    setPreviews(p => p.filter((_, idx) => idx !== i))
  }

  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const doUpdate = async (status, noProofReason) => {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('status', status)
      fd.append('observations', form.observations || '')
      if (status === 'ocorrencia')   fd.append('occurrence', form.occurrence || '')
      if (status === 'nao_entregue') fd.append('no_delivery_reason', form.no_delivery_reason || '')
      fd.append('tubes_had',         form.tubes_had         ? 1 : 0)
      fd.append('tubes_collected',   form.tubes_collected    ? 1 : 0)
      if (form.tubes_had && form.tubes_quantity) fd.append('tubes_quantity', form.tubes_quantity)
      fd.append('tubes_pending',     form.tubes_pending      ? 1 : 0)
      if (form.tubes_pending && form.tubes_pending_qty) fd.append('tubes_pending_qty', form.tubes_pending_qty)
      if (form.tubes_obs) fd.append('tubes_obs', form.tubes_obs)
      if (noProofReason)  fd.append('no_proof_reason', noProofReason)
      newPhotos.forEach(f => fd.append('canhoto_photos', f))

      await api.put(`/deliveries/${selected.id}/status`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
      setSelected(null)
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error || 'Erro ao atualizar'
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (status) => {
    if (status === 'entregue') {
      const hasExisting = selected.canhoto_photo || (selected.canhoto_photos?.length > 0)
      const hasSending  = newPhotos.length > 0
      if (!hasExisting && !hasSending) {
        setPendingStatus(status)
        setJustOpen(true)
        return
      }
    }
    doUpdate(status, '')
  }

  const activeStatuses = ['pendente', 'saiu_entrega', 'chegou_cliente']
  const pendentes  = deliveries.filter(d => activeStatuses.includes(d.status))
  const concluidas = deliveries.filter(d => !activeStatuses.includes(d.status))

  const existingPhotos = selected?.canhoto_photos || []
  const legacyPhoto    = selected?.canhoto_photo

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        <button onClick={() => setTab('pendentes')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'pendentes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          Pendentes {pendentes.length > 0 && <span className="ml-1 bg-brand-500 text-white text-xs rounded-full px-1.5">{pendentes.length}</span>}
        </button>
        <button onClick={() => setTab('concluidas')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'concluidas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          Concluídas ({concluidas.length})
        </button>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/>
        </div>
      ) : (
        <>
          {/* Lista Pendentes */}
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
                      <div className="text-sm text-brand-600 font-semibold">{d.city}</div>
                      {d.phone && <div className="text-xs text-slate-400 mt-1">📞 {d.phone}</div>}
                      {d.items?.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500">
                          {d.items.slice(0, 2).map((it, i) => <div key={i}>{it.quantity}x {it.sku_name}</div>)}
                          {d.items.length > 2 && <div>+{d.items.length - 2} item(s)...</div>}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <StatusBadge status={d.status} />
                        <TubeTag d={d} />
                      </div>
                    </div>
                    <span className="text-brand-500 text-2xl flex-shrink-0">›</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Lista Concluídas */}
          {tab === 'concluidas' && (
            <div className="space-y-2">
              {concluidas.map(d => (
                <button key={d.id} onClick={() => openDelivery(d)} className="card p-4 w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 truncate">{d.client_name}</div>
                      <div className="text-xs text-slate-400">{d.city}</div>
                      {d.completion_time && (
                        <div className="text-xs text-slate-400">{new Date(d.completion_time).toLocaleString('pt-BR')}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusBadge status={d.status} />
                      <CanhotoTag d={d} />
                      <TubeTag d={d} />
                    </div>
                  </div>
                </button>
              ))}
              {concluidas.length === 0 && <div className="text-center py-8 text-slate-400">Nenhuma entrega concluída</div>}
            </div>
          )}
        </>
      )}

      {/* Modal de entrega */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalhes da Entrega">
        {selected && (
          <div className="space-y-3">

            {/* A — Info do cliente */}
            <Section title="Cliente e Pedido" icon="🏢" defaultOpen>
              <div className="font-bold text-slate-800 text-base">{selected.client_name}</div>
              <div className="text-sm text-slate-600">{selected.address}, {selected.city}</div>
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1 text-brand-500 font-semibold text-sm">
                  📞 {selected.phone}
                </a>
              )}
              {selected.items?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Itens a entregar</p>
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
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-slate-400">Status atual:</span>
                <StatusBadge status={selected.status} />
              </div>
            </Section>

            {/* B — Tubos */}
            <Section title="Controle de Tubos" icon="🔄" defaultOpen={!!selected.tubes_had}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.tubes_had}
                  onChange={e => F('tubes_had', e.target.checked)}
                  className="w-5 h-5 accent-brand-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-slate-700">Havia tubo para recolher?</span>
              </label>

              {form.tubes_had && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.tubes_collected}
                      onChange={e => F('tubes_collected', e.target.checked)}
                      className="w-5 h-5 accent-green-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700">Tubos foram recolhidos?</span>
                  </label>

                  {form.tubes_collected && (
                    <div>
                      <label className="label">Quantidade recolhida</label>
                      <input type="number" value={form.tubes_quantity}
                        onChange={e => F('tubes_quantity', e.target.value)}
                        className="input" min="1" placeholder="Ex: 12" />
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.tubes_pending}
                      onChange={e => F('tubes_pending', e.target.checked)}
                      className="w-5 h-5 accent-red-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700">Ficou tubo pendente?</span>
                  </label>

                  {form.tubes_pending && (
                    <div>
                      <label className="label">Quantidade pendente</label>
                      <input type="number" value={form.tubes_pending_qty}
                        onChange={e => F('tubes_pending_qty', e.target.value)}
                        className="input" min="1" placeholder="Ex: 3" />
                    </div>
                  )}

                  <div>
                    <label className="label">Observação sobre recolhimento</label>
                    <textarea value={form.tubes_obs}
                      onChange={e => F('tubes_obs', e.target.value)}
                      className="input" rows={2}
                      placeholder="Ex: Cliente disse que recolhe o restante na próxima visita..." />
                  </div>
                </>
              )}
            </Section>

            {/* C — Comprovante */}
            <Section title="Comprovante / Canhoto" icon="📄" defaultOpen>
              {/* Canhotos já salvos */}
              {(existingPhotos.length > 0 || legacyPhoto) && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">
                    {existingPhotos.length + (legacyPhoto ? 1 : 0)} foto(s) já enviada(s)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {legacyPhoto && (
                      <a href={`/uploads/${legacyPhoto}`} target="_blank" rel="noopener noreferrer"
                        className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:border-brand-400">
                        <img src={`/uploads/${legacyPhoto}`} alt="canhoto" className="w-full h-full object-cover" />
                      </a>
                    )}
                    {existingPhotos.map((p, i) => (
                      <a key={i} href={`/uploads/${p.filename}`} target="_blank" rel="noopener noreferrer"
                        className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:border-brand-400">
                        <img src={`/uploads/${p.filename}`} alt={`canhoto ${i+1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Novo(s) upload */}
              <div>
                <label className="label">Adicionar foto(s) do canhoto</label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple
                  onChange={e => handlePhotos(e.target.files)}
                  className="hidden" />
                <button type="button" onClick={() => fileRef.current.click()}
                  className="w-full border-2 border-dashed border-slate-300 rounded-xl py-4 text-center text-slate-500 text-sm hover:border-brand-400 hover:text-brand-500 transition-colors active:bg-slate-50">
                  📷 Tirar foto / Escolher arquivo
                </button>
              </div>

              {/* Previews dos novos */}
              {previews.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">{previews.length} nova(s) foto(s) selecionada(s):</p>
                  <div className="flex flex-wrap gap-2">
                    {previews.map((url, i) => (
                      <div key={i} className="relative w-20 h-20">
                        <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none"
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingPhotos.length === 0 && !legacyPhoto && newPhotos.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  ⚠ Nenhum comprovante ainda. Para marcar como entregue, adicione o canhoto ou informe uma justificativa.
                </p>
              )}
            </Section>

            {/* D — Observações */}
            <Section title="Observações" icon="📝">
              <textarea value={form.observations}
                onChange={e => F('observations', e.target.value)}
                className="input" rows={3} placeholder="Informações adicionais da entrega..." />

              {selected.status === 'ocorrencia' && (
                <div>
                  <label className="label">Descrição da ocorrência</label>
                  <textarea value={form.occurrence}
                    onChange={e => F('occurrence', e.target.value)}
                    className="input" rows={2} />
                </div>
              )}
              {selected.status === 'nao_entregue' && (
                <div>
                  <label className="label">Motivo de não entrega</label>
                  <input value={form.no_delivery_reason}
                    onChange={e => F('no_delivery_reason', e.target.value)}
                    className="input" placeholder="Ex: Cliente ausente" />
                </div>
              )}
            </Section>

            {/* E — Botões de status */}
            <div className="space-y-2 pt-1">
              {[
                { key: 'saiu_entrega',   label: 'Saí para Entrega',        icon: '🚗', color: 'bg-orange-500 active:bg-orange-600' },
                { key: 'chegou_cliente', label: 'Cheguei no Cliente',       icon: '📍', color: 'bg-blue-500 active:bg-blue-600' },
                { key: 'entregue',       label: 'Confirmar Entrega ✓',      icon: '✅', color: 'bg-green-500 active:bg-green-600' },
                { key: 'nao_entregue',   label: 'Não Consegui Entregar',    icon: '❌', color: 'bg-slate-500 active:bg-slate-600' },
                { key: 'ocorrencia',     label: 'Registrar Ocorrência',     icon: '⚠️', color: 'bg-yellow-500 active:bg-yellow-600' },
              ].map(s => {
                const isCurrent = selected.status === s.key
                return (
                  <button key={s.key}
                    onClick={() => handleAction(s.key)}
                    disabled={loading || isCurrent}
                    className={`w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all ${s.color} disabled:opacity-40 flex items-center justify-center gap-2`}>
                    {loading && pendingStatus === s.key ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : isCurrent ? (
                      <span className="opacity-70">✓ Status atual: {s.label}</span>
                    ) : (
                      <span>{s.icon} {s.label}</span>
                    )}
                  </button>
                )
              })}
            </div>

          </div>
        )}
      </Modal>

      {/* Mini-modal de justificativa */}
      <JustModal
        open={justOpen}
        onConfirm={(reason) => {
          setJustOpen(false)
          doUpdate(pendingStatus, reason)
          setPendingStatus(null)
        }}
        onCancel={() => { setJustOpen(false); setPendingStatus(null) }}
      />
    </div>
  )
}
