import { useState, useEffect, useRef } from 'react'
import api from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

/* ─── helpers visuais ──────────────────────────────────────────────────────── */
function CanhotoTag({ d }) {
  const hasPhoto = d.canhoto_photo || d.canhoto_count > 0
  if (d.status === 'entregue' && hasPhoto)
    return <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">📄 OK</span>
  if (d.status === 'entregue' && !hasPhoto)
    return <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">⚠ sem canhoto</span>
  return null
}

function TubeTag({ d }) {
  if (d.tubes_pending)
    return <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">⚠ tubo pendente</span>
  if (d.tubes_had)
    return <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">🔄 tubos OK</span>
  return null
}

/* ─── Seção colapsável ─────────────────────────────────────────────────────── */
function Section({ title, icon, defaultOpen = false, required = false, hasError = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`border rounded-xl overflow-hidden ${hasError ? 'border-red-400' : 'border-slate-200'}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${hasError ? 'bg-red-50' : 'bg-slate-50 hover:bg-slate-100'}`}
      >
        <span className={`font-bold text-sm ${hasError ? 'text-red-600' : 'text-slate-700'}`}>
          {icon} {title}
          {required && <span className="text-red-500 ml-1">*</span>}
        </span>
        <span className={`text-sm ${hasError ? 'text-red-400' : 'text-slate-400'}`}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}

/* ─── Toggle sim/não ───────────────────────────────────────────────────────── */
function YesNo({ label, value, onChange, required = false }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-2">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </p>
      <div className="flex gap-2">
        {[{ v: 1, label: 'Sim', color: value === 1 ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600' },
          { v: 0, label: 'Não', color: value === 0 ? 'bg-slate-500 text-white' : 'bg-slate-100 text-slate-600' }]
          .map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChange(opt.v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${opt.color}`}
            >
              {opt.label}
            </button>
          ))}
      </div>
    </div>
  )
}

/* ─── Campo numérico de tubos ──────────────────────────────────────────────── */
function TubeQty({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input"
        min="0"
        placeholder="0"
      />
    </div>
  )
}

/* ─── Erros de validação ───────────────────────────────────────────────────── */
function Errors({ list }) {
  if (!list.length) return null
  return (
    <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 space-y-1">
      {list.map((msg, i) => (
        <p key={i} className="text-sm text-red-700 flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">⛔</span>
          <span>{msg}</span>
        </p>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Entregas() {
  const [deliveries, setDeliveries] = useState([])
  const [selected, setSelected]     = useState(null)
  const [form, setForm]             = useState({})
  const [newPhotos, setNewPhotos]   = useState([])
  const [previews, setPreviews]     = useState([])
  const [errors, setErrors]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [fetching, setFetching]     = useState(true)
  const [tab, setTab]               = useState('pendentes')
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
      tubes_had:         r.data.tubes_had === 1 ? 1 : r.data.tubes_had === 0 && r.data.status === 'entregue' ? 0 : null,
      tubes_qty_p5:      r.data.tubes_qty_p5      || '',
      tubes_qty_p10:     r.data.tubes_qty_p10     || '',
      tubes_pending:     r.data.tubes_pending === 1 ? 1 : r.data.tubes_pending === 0 && r.data.status === 'entregue' ? 0 : null,
      tubes_pending_p5:  r.data.tubes_pending_p5  || '',
      tubes_pending_p10: r.data.tubes_pending_p10 || '',
      tubes_obs:         r.data.tubes_obs         || '',
    })
    setNewPhotos([])
    setPreviews([])
    setErrors([])
  }

  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handlePhotos = (files) => {
    const arr = Array.from(files)
    setNewPhotos(arr)
    setPreviews(arr.map(f => URL.createObjectURL(f)))
  }

  const removePhoto = (i) => {
    setNewPhotos(p => p.filter((_, idx) => idx !== i))
    setPreviews(p => p.filter((_, idx) => idx !== i))
  }

  /* ── Validação client-side (espelho do backend) ── */
  const validate = () => {
    const errs = []
    if (form.tubes_had === null || form.tubes_had === undefined)
      errs.push('Informe se houve recolhimento de tubos antes de concluir.')
    if (form.tubes_pending === null || form.tubes_pending === undefined)
      errs.push('Informe se ficou pendência de tubo antes de concluir.')
    const hasExisting = selected?.canhoto_photo || selected?.canhoto_photos?.length > 0
    if (!hasExisting && newPhotos.length === 0)
      errs.push('Anexe a foto do canhoto assinado para concluir a entrega.')
    return errs
  }

  const doUpdate = async (status) => {
    // Validação só no fechamento
    if (status === 'entregue') {
      const errs = validate()
      if (errs.length) { setErrors(errs); return }
    }

    setLoading(true)
    setErrors([])
    try {
      const fd = new FormData()
      fd.append('status', status)
      fd.append('observations', form.observations || '')
      if (form.occurrence)        fd.append('occurrence', form.occurrence)
      if (form.no_delivery_reason) fd.append('no_delivery_reason', form.no_delivery_reason)

      // Tubos — sempre envia o que o motorista preencheu
      if (form.tubes_had !== null && form.tubes_had !== undefined) {
        fd.append('tubes_had', form.tubes_had)
        if (form.tubes_had === 1) {
          fd.append('tubes_qty_p5',  form.tubes_qty_p5  || 0)
          fd.append('tubes_qty_p10', form.tubes_qty_p10 || 0)
          fd.append('tubes_quantity', (parseInt(form.tubes_qty_p5 || 0) + parseInt(form.tubes_qty_p10 || 0)).toString())
        }
      }
      if (form.tubes_pending !== null && form.tubes_pending !== undefined) {
        fd.append('tubes_pending', form.tubes_pending)
        if (form.tubes_pending === 1) {
          fd.append('tubes_pending_p5',  form.tubes_pending_p5  || 0)
          fd.append('tubes_pending_p10', form.tubes_pending_p10 || 0)
        }
      }
      if (form.tubes_obs) fd.append('tubes_obs', form.tubes_obs)

      newPhotos.forEach(f => fd.append('canhoto_photos', f))

      await api.put(`/deliveries/${selected.id}/status`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await load()
      setSelected(null)
    } catch (e) {
      const data = e.response?.data
      if (data?.messages) setErrors(data.messages)
      else setErrors([data?.message || data?.error || 'Erro ao atualizar'])
    } finally {
      setLoading(false)
    }
  }

  /* ── partições das listas ── */
  const ACTIVE = ['pendente', 'saiu_entrega', 'chegou_cliente']
  const pendentes  = deliveries.filter(d => ACTIVE.includes(d.status))
  const concluidas = deliveries.filter(d => !ACTIVE.includes(d.status))

  const existingPhotos = selected?.canhoto_photos || []
  const legacyPhoto    = selected?.canhoto_photo

  /* ── helpers de validação para abrir seções com erro ── */
  const tubesHasError  = errors.some(e => e.includes('tubos') || e.includes('pendência'))
  const canhotoHasError = errors.some(e => e.includes('canhoto'))

  const isDone = selected && !ACTIVE.includes(selected.status)

  /* ════════════════════ RENDER ══════════════════════════════════════════════ */
  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        <button onClick={() => setTab('pendentes')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'pendentes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          Em andamento
          {pendentes.length > 0 && <span className="ml-1.5 bg-brand-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendentes.length}</span>}
        </button>
        <button onClick={() => setTab('concluidas')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'concluidas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
          Concluídas ({concluidas.length})
        </button>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ── Lista: pendentes ── */}
          {tab === 'pendentes' && (
            <div className="space-y-3">
              {pendentes.length === 0 ? (
                <div className="card p-10 text-center">
                  <div className="text-5xl mb-3">🎉</div>
                  <p className="font-bold text-slate-700">Nenhuma entrega pendente!</p>
                  <p className="text-sm text-slate-400 mt-1">Todas as entregas foram concluídas.</p>
                </div>
              ) : pendentes.map(d => (
                <button key={d.id} onClick={() => openDelivery(d)}
                  className="card p-4 w-full text-left active:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-base">{d.client_name}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{d.address}</div>
                      <div className="text-sm text-brand-600 font-semibold">{d.city}</div>
                      {d.phone && (
                        <div className="text-xs text-slate-400 mt-0.5">📞 {d.phone}</div>
                      )}
                      {d.items?.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                          {d.items.slice(0, 3).map((it, i) => (
                            <div key={i}>{it.quantity}x {it.sku_name}</div>
                          ))}
                          {d.items.length > 3 && <div>+{d.items.length - 3} item(s)…</div>}
                        </div>
                      )}
                      <div className="mt-2">
                        <StatusBadge status={d.status} />
                      </div>
                    </div>
                    <span className="text-brand-400 text-2xl flex-shrink-0">›</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Lista: concluídas ── */}
          {tab === 'concluidas' && (
            <div className="space-y-2">
              {concluidas.map(d => (
                <button key={d.id} onClick={() => openDelivery(d)}
                  className="card p-4 w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 truncate">{d.client_name}</div>
                      <div className="text-xs text-slate-400">{d.city}</div>
                      {d.completion_time && (
                        <div className="text-xs text-slate-400">
                          {new Date(d.completion_time).toLocaleString('pt-BR')}
                        </div>
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
              {concluidas.length === 0 && (
                <div className="text-center py-8 text-slate-400">Nenhuma entrega concluída</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ MODAL DE ENTREGA ════════════════════════════════ */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalhes da Entrega">
        {selected && (
          <div className="space-y-3">

            {/* A ── Informações do cliente */}
            <Section title="Cliente e Pedido" icon="🏢" defaultOpen>
              <div className="font-bold text-slate-800 text-base">{selected.client_name}</div>
              <div className="text-sm text-slate-600">{selected.address}, {selected.city}</div>
              {selected.phone && (
                <a href={`tel:${selected.phone}`}
                  className="inline-flex items-center gap-1 text-brand-500 font-semibold text-sm mt-0.5">
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
                        <span className="font-bold">{item.quantity} {item.unit || 'un'}</span>
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

            {/* B ── Controle de Tubos (obrigatório ao fechar) */}
            <Section
              title="Controle de Tubos"
              icon="🔄"
              required={!isDone}
              hasError={tubesHasError}
              defaultOpen={tubesHasError || !!selected.tubes_had}
            >
              <YesNo
                label="Houve recolhimento de tubo?"
                value={form.tubes_had}
                onChange={v => F('tubes_had', v)}
                required
              />

              {form.tubes_had === 1 && (
                <div className="pl-2 border-l-2 border-green-200 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase">Quantidade recolhida</p>
                  <div className="grid grid-cols-2 gap-3">
                    <TubeQty label="Tubo P5" value={form.tubes_qty_p5} onChange={v => F('tubes_qty_p5', v)} />
                    <TubeQty label="Tubo P10" value={form.tubes_qty_p10} onChange={v => F('tubes_qty_p10', v)} />
                  </div>
                  {(parseInt(form.tubes_qty_p5 || 0) + parseInt(form.tubes_qty_p10 || 0)) > 0 && (
                    <p className="text-xs text-green-700 font-semibold">
                      Total: {parseInt(form.tubes_qty_p5 || 0) + parseInt(form.tubes_qty_p10 || 0)} tubos recolhidos
                    </p>
                  )}
                </div>
              )}

              <YesNo
                label="Ficou pendência de tubo?"
                value={form.tubes_pending}
                onChange={v => F('tubes_pending', v)}
                required
              />

              {form.tubes_pending === 1 && (
                <div className="pl-2 border-l-2 border-red-200 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase">Quantidade pendente</p>
                  <div className="grid grid-cols-2 gap-3">
                    <TubeQty label="Tubo P5" value={form.tubes_pending_p5} onChange={v => F('tubes_pending_p5', v)} />
                    <TubeQty label="Tubo P10" value={form.tubes_pending_p10} onChange={v => F('tubes_pending_p10', v)} />
                  </div>
                  {(parseInt(form.tubes_pending_p5 || 0) + parseInt(form.tubes_pending_p10 || 0)) > 0 && (
                    <p className="text-xs text-red-600 font-semibold">
                      {parseInt(form.tubes_pending_p5 || 0) + parseInt(form.tubes_pending_p10 || 0)} tubos ficaram com o cliente
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="label">Observação (opcional)</label>
                <textarea
                  value={form.tubes_obs}
                  onChange={e => F('tubes_obs', e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="Ex: cliente vai juntar mais tubos para próxima visita…"
                />
              </div>
            </Section>

            {/* C ── Canhoto (obrigatório ao fechar) */}
            <Section
              title="Canhoto Assinado"
              icon="📄"
              required={!isDone}
              hasError={canhotoHasError}
              defaultOpen={canhotoHasError || existingPhotos.length > 0 || !!legacyPhoto}
            >
              {/* Fotos já salvas */}
              {(existingPhotos.length > 0 || legacyPhoto) && (
                <div>
                  <p className="text-xs font-bold text-green-700 mb-2">
                    ✅ {existingPhotos.length + (legacyPhoto ? 1 : 0)} foto(s) já enviada(s)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {legacyPhoto && (
                      <a href={`/uploads/${legacyPhoto}`} target="_blank" rel="noopener noreferrer"
                        className="block w-20 h-20 rounded-xl overflow-hidden border-2 border-green-200">
                        <img src={`/uploads/${legacyPhoto}`} alt="canhoto" className="w-full h-full object-cover" />
                      </a>
                    )}
                    {existingPhotos.map((p, i) => (
                      <a key={i} href={`/uploads/${p.filename}`} target="_blank" rel="noopener noreferrer"
                        className="block w-20 h-20 rounded-xl overflow-hidden border-2 border-green-200">
                        <img src={`/uploads/${p.filename}`} alt={`canhoto ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Novo upload */}
              {!isDone && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={e => handlePhotos(e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current.click()}
                    className={`w-full border-2 border-dashed rounded-xl py-5 text-center text-sm transition-colors ${
                      canhotoHasError
                        ? 'border-red-400 text-red-500 bg-red-50'
                        : 'border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-500'
                    }`}
                  >
                    📷 Tirar foto / Escolher da galeria
                    <div className="text-xs mt-1 opacity-70">Pode anexar mais de uma foto</div>
                  </button>

                  {previews.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        {previews.length} nova(s) foto(s) selecionada(s):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {previews.map((url, i) => (
                          <div key={i} className="relative w-20 h-20">
                            <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {existingPhotos.length === 0 && !legacyPhoto && newPhotos.length === 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ⚠ Nenhum canhoto ainda. Obrigatório para concluir a entrega.
                    </p>
                  )}
                </>
              )}
            </Section>

            {/* D ── Observações gerais */}
            <Section title="Observações" icon="📝">
              <textarea
                value={form.observations}
                onChange={e => F('observations', e.target.value)}
                className="input"
                rows={3}
                placeholder="Informações adicionais sobre a entrega…"
              />
              {['ocorrencia'].includes(selected.status) && (
                <div>
                  <label className="label">Descrição da ocorrência</label>
                  <textarea value={form.occurrence} onChange={e => F('occurrence', e.target.value)}
                    className="input" rows={2} />
                </div>
              )}
            </Section>

            {/* ── Erros de validação ── */}
            <Errors list={errors} />

            {/* E ── Botões de status */}
            {!isDone ? (
              <div className="space-y-2 pt-1">

                {/* Botões intermediários — SEM validação */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'saiu_entrega',   label: 'Saí para entrega', icon: '🚗', color: 'bg-orange-500 active:bg-orange-600' },
                    { key: 'chegou_cliente', label: 'Cheguei no cliente', icon: '📍', color: 'bg-blue-500 active:bg-blue-600' },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => doUpdate(s.key)}
                      disabled={loading || selected.status === s.key}
                      className={`py-3 rounded-xl text-white font-bold text-sm transition-all ${s.color} disabled:opacity-40`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>

                {/* Botão de conclusão — COM validação obrigatória */}
                <button
                  onClick={() => doUpdate('entregue')}
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-green-500 active:bg-green-600 text-white font-black text-base transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading
                    ? <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : '✅ Confirmar Entrega'}
                </button>

                {/* Botões secundários */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'nao_entregue', label: 'Não entregue', icon: '❌', color: 'bg-slate-500 active:bg-slate-600' },
                    { key: 'ocorrencia',   label: 'Ocorrência',   icon: '⚠️', color: 'bg-yellow-500 active:bg-yellow-600' },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => doUpdate(s.key)}
                      disabled={loading}
                      className={`py-3 rounded-xl text-white font-bold text-sm transition-all ${s.color} disabled:opacity-40`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-slate-500">Entrega finalizada</p>
                <StatusBadge status={selected.status} />
              </div>
            )}

          </div>
        )}
      </Modal>
    </div>
  )
}
