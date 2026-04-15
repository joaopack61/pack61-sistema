import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'

function FieldRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 flex-shrink-0 mr-3">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value}</span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MotoristaEntregas() {
  const [tab, setTab]               = useState('disponiveis')
  const [available, setAvailable]   = useState([])   // delivery_status = DISPONIVEL
  const [deliveries, setDeliveries] = useState([])   // entregas atribuídas ao motorista
  const [selected, setSelected]     = useState(null) // entrega selecionada (modal)
  const [availSel, setAvailSel]     = useState(null) // pedido disponível selecionado
  const [loading, setLoading]       = useState(false)
  const [accepting, setAccepting]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [errors, setErrors]         = useState([])
  const [lastRefresh, setLastRefresh] = useState(null)

  // Form de conclusão de entrega
  const [form, setForm] = useState({
    tubes_had: '', tubes_qty_p5: 0, tubes_qty_p10: 0,
    tubes_pending: '', tubes_pending_p5: 0, tubes_pending_p10: 0,
    tubes_obs: '', observations: '',
  })
  const [photos, setPhotos]     = useState([])
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const fileRef               = useRef(null)

  // Monta URL segura para imagens (relativa funciona no Railway)
  const photoSrc = (raw) => {
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    if (raw.startsWith('/')) return raw
    return `/uploads/${raw}`
  }

  // ── Carregar dados ──────────────────────────────────────────────────────────

  const loadAvailable = useCallback(async () => {
    try {
      const r = await api.get('/orders/delivery', { params: { status: 'DISPONIVEL' } })
      setAvailable(r.data)
    } catch {}
  }, [])

  const loadDeliveries = useCallback(async () => {
    try {
      const r = await api.get('/deliveries')
      setDeliveries(r.data)
    } catch {}
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadAvailable(), loadDeliveries()])
    setLastRefresh(new Date())
    setLoading(false)
  }, [loadAvailable, loadDeliveries])

  // Carga inicial
  useEffect(() => { loadAll() }, [loadAll])

  // Polling a cada 10 segundos
  useEffect(() => {
    const id = setInterval(() => loadAll(), 10000)
    return () => clearInterval(id)
  }, [loadAll])

  // ── Aceitar pedido disponível ───────────────────────────────────────────────

  const handleAccept = async (order) => {
    setAccepting(true)
    try {
      await api.put(`/orders/${order.id}/accept`)
      setAvailSel(null)
      await loadAll()
      setTab('em_rota')
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao aceitar pedido')
    } finally {
      setAccepting(false)
    }
  }

  // ── Não consegui entregar ───────────────────────────────────────────────────

  const [failModal, setFailModal] = useState(null) // delivery com failModal aberto
  const [failReason, setFailReason] = useState('')

  const handleAttemptFailed = async () => {
    if (!failReason.trim()) { alert('Informe o motivo da tentativa falha.'); return }
    setSaving(true)
    try {
      await api.put(`/orders/${failModal.id}/attempt-failed`, { reason: failReason })
      setFailModal(null)
      setFailReason('')
      setSelected(null)
      await loadAll()
      setTab('disponiveis')
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao registrar tentativa')
    } finally {
      setSaving(false)
    }
  }

  // ── Abrir modal de entrega ──────────────────────────────────────────────────

  const openDelivery = async (d) => {
    const r = await api.get(`/deliveries/${d.id}`)
    const full = r.data
    setSelected(full)
    setPhotos([])
    setErrors([])
    setForm({
      tubes_had:       full.tubes_had      != null ? String(full.tubes_had)      : '',
      tubes_qty_p5:    full.tubes_qty_p5   || 0,
      tubes_qty_p10:   full.tubes_qty_p10  || 0,
      tubes_pending:   full.tubes_pending  != null ? String(full.tubes_pending)  : '',
      tubes_pending_p5:  full.tubes_pending_p5  || 0,
      tubes_pending_p10: full.tubes_pending_p10 || 0,
      tubes_obs:       full.tubes_obs      || '',
      observations:    full.observations   || '',
    })
  }

  // ── Salvar status da entrega ────────────────────────────────────────────────

  const handleStatus = async (targetStatus) => {
    setSaving(true)
    setErrors([])
    try {
      const fd = new FormData()
      fd.append('status', targetStatus)
      if (form.tubes_had     !== '') fd.append('tubes_had',     form.tubes_had)
      if (form.tubes_pending !== '') fd.append('tubes_pending', form.tubes_pending)
      fd.append('tubes_qty_p5',     form.tubes_qty_p5     || 0)
      fd.append('tubes_qty_p10',    form.tubes_qty_p10    || 0)
      fd.append('tubes_pending_p5', form.tubes_pending_p5 || 0)
      fd.append('tubes_pending_p10',form.tubes_pending_p10|| 0)
      if (form.tubes_obs)    fd.append('tubes_obs',    form.tubes_obs)
      if (form.observations) fd.append('observations', form.observations)
      for (const f of photos) fd.append('canhoto_photos', f)

      await api.put(`/deliveries/${selected.id}/status`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadAll()
      setSelected(null)
    } catch (e) {
      const msgs = e.response?.data?.messages || [e.response?.data?.error || 'Erro ao salvar']
      setErrors(msgs)
    } finally {
      setSaving(false)
    }
  }

  // ── Partições ───────────────────────────────────────────────────────────────

  const inProgress = deliveries.filter(d => ['pendente','saiu_entrega','chegou_cliente'].includes(d.status))
  const done       = deliveries.filter(d => ['entregue','nao_entregue','ocorrencia'].includes(d.status))

  const TABS = [
    { key: 'disponiveis', label: `Disponíveis (${available.length})`, dot: available.length > 0 },
    { key: 'em_rota',     label: `Em Rota (${inProgress.length})` },
    { key: 'historico',   label: `Histórico (${done.length})` },
  ]

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header com status de atualização */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-colors relative ${tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
              {t.dot && tab !== t.key && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-brand-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
        <button onClick={loadAll} disabled={loading}
          className="ml-2 p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex-shrink-0"
          title="Atualizar">
          {loading ? (
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      </div>

      {lastRefresh && (
        <p className="text-xs text-slate-400 text-center">
          Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Atualização automática a cada 10s
        </p>
      )}

      {/* ── ABA: Disponíveis ───────────────────────────────────────────────── */}
      {tab === 'disponiveis' && (
        <div className="space-y-3">
          {available.length === 0 && (
            <div className="card p-10 text-center text-slate-400">
              <div className="text-4xl mb-2">📭</div>
              <p className="font-medium">Nenhum pedido disponível agora</p>
              <p className="text-xs mt-1">Aguarde pedidos prontos para expedição</p>
            </div>
          )}
          {available.map(order => (
            <button key={order.id} onClick={() => setAvailSel(order)}
              className="card p-4 w-full text-left hover:bg-green-50 border-2 border-transparent hover:border-green-200 transition-all active:bg-green-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Disponível</span>
                    <span className="text-xs text-slate-400">Pedido #{order.id}</span>
                  </div>
                  <div className="font-bold text-slate-800 text-base truncate">{order.client_name}</div>
                  {order.address && <div className="text-xs text-slate-500 mt-0.5 truncate">{order.address}, {order.city}</div>}
                  {order.phone && <div className="text-xs text-brand-500 mt-0.5">📞 {order.phone}</div>}
                  {order.items?.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {order.items.slice(0, 3).map((it, i) => (
                        <div key={i} className="text-xs text-slate-500">{it.quantity}× {it.sku_name}</div>
                      ))}
                      {order.items.length > 3 && <div className="text-xs text-slate-400">+{order.items.length - 3} itens</div>}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-lg font-black text-green-600">R$ {Number(order.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs text-slate-400 mt-1">{fmtDate(order.updated_at)}</div>
                  <div className="mt-2 text-xs bg-brand-500 text-white font-bold px-3 py-1.5 rounded-lg">Aceitar →</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── ABA: Em Rota ───────────────────────────────────────────────────── */}
      {tab === 'em_rota' && (
        <div className="space-y-3">
          {inProgress.length === 0 && (
            <div className="card p-10 text-center text-slate-400">
              <div className="text-4xl mb-2">🚚</div>
              <p className="font-medium">Nenhuma entrega em andamento</p>
              <p className="text-xs mt-1">Aceite uma entrega na aba "Disponíveis"</p>
            </div>
          )}
          {inProgress.map(d => (
            <button key={d.id} onClick={() => openDelivery(d)}
              className="card p-4 w-full text-left hover:bg-slate-50 transition-colors active:bg-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-base truncate">{d.client_name}</div>
                  {d.address && <div className="text-xs text-slate-500 truncate">{d.address}, {d.city}</div>}
                  {d.phone && <div className="text-xs text-brand-500 mt-0.5">📞 {d.phone}</div>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <StatusBadge status={d.status} />
                    {d.departure_time && <span className="text-xs text-slate-400">Saída {fmt(d.departure_time)}</span>}
                  </div>
                  {d.items?.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {d.items.slice(0, 2).map((it, i) => (
                        <div key={i} className="text-xs text-slate-500">{it.quantity}× {it.sku_name}</div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-brand-500 text-2xl flex-shrink-0">›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── ABA: Histórico ────────────────────────────────────────────────── */}
      {tab === 'historico' && (
        <div className="space-y-2">
        <p className="text-xs text-slate-500">{done.length} entrega(s) finalizada(s)</p>
          {done.length === 0 && (
            <div className="card p-10 text-center text-slate-400">
              <div className="text-4xl mb-2">📋</div>
              <p className="font-medium">Nenhuma entrega finalizada</p>
            </div>
          )}
          {done.map(d => (
            <button key={d.id} onClick={() => openDelivery(d)}
              className="card p-4 w-full text-left hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{d.client_name}</div>
                  <div className="text-xs text-slate-500 truncate">{d.city}</div>
                  {d.completion_time && (
                    <div className="text-xs text-slate-400 mt-0.5">{fmt(d.completion_time)}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={d.status} />
                  {(d.canhoto_count > 0 || d.canhoto_photo) && (
                    <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">📄 canhoto</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Modal: Aceitar pedido disponível ──────────────────────────────── */}
      <Modal open={!!availSel} onClose={() => setAvailSel(null)} title="Confirmar Aceite">
        {availSel && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <div className="font-bold text-slate-800 text-lg">{availSel.client_name}</div>
              {availSel.address && <div className="text-sm text-slate-600">{availSel.address}, {availSel.city}</div>}
              {availSel.phone && (
                <a href={`tel:${availSel.phone}`} className="text-sm text-brand-600 font-semibold block">📞 {availSel.phone}</a>
              )}
              {availSel.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(`${availSel.address}, ${availSel.city}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 font-semibold mt-1">
                  🗺️ Abrir no Maps
                </a>
              )}
            </div>

            {availSel.items?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Itens do Pedido</p>
                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  {availSel.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                      <span className="text-slate-700">{it.sku_name}</span>
                      <span className="text-slate-500 font-semibold">{it.quantity}×</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-1 font-black text-brand-600">
                    <span>Total do pedido</span>
                    <span>R$ {Number(availSel.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              Ao aceitar, este pedido será atribuído a você e ficará visível na aba "Em Rota".
            </div>

            <div className="flex gap-2">
              <button onClick={() => setAvailSel(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => handleAccept(availSel)} disabled={accepting}
                className="btn-primary flex-1 bg-green-500 hover:bg-green-600">
                {accepting ? 'Aceitando...' : '✅ Aceitar Entrega'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Gerenciar entrega ───────────────────────────────────────── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.client_name || 'Entrega'}>
        {selected && (
          <div className="space-y-4">
            {/* Info */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <div className="font-bold text-slate-800">{selected.client_name}</div>
              {selected.address && <div className="text-xs text-slate-500">{selected.address}, {selected.city}</div>}
              {selected.phone && <a href={`tel:${selected.phone}`} className="text-xs text-brand-500 font-semibold block">📞 {selected.phone}</a>}
              <StatusBadge status={selected.status} />
              <div className="grid grid-cols-2 gap-2 mt-2">
                {selected.departure_time  && <div className="text-xs text-slate-500">Saída: {fmt(selected.departure_time)}</div>}
                {selected.arrival_time    && <div className="text-xs text-slate-500">Chegada: {fmt(selected.arrival_time)}</div>}
                {selected.completion_time && <div className="text-xs text-slate-500">Conclusão: {fmt(selected.completion_time)}</div>}
              </div>
            </div>

            {/* Itens */}
            {selected.items?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Itens Entregues</p>
                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  {selected.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                      <span className="text-slate-700 truncate">{it.sku_name}</span>
                      <span className="text-slate-500 ml-2">{it.quantity}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botões de status intermediários (livres) */}
            {!['entregue','nao_entregue','ocorrencia'].includes(selected.status) && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Atualizar Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { s: 'saiu_entrega',   label: '🚚 Sair para Entrega' },
                    { s: 'chegou_cliente', label: '📍 Cheguei no Cliente' },
                  ].map(({ s, label }) => (
                    <button key={s} type="button"
                      onClick={() => handleStatus(s)}
                      disabled={saving || selected.status === s}
                      className={`py-3 rounded-xl text-sm font-bold border transition-colors disabled:opacity-50 ${selected.status === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                      {saving ? '...' : label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dados de tubos (obrigatórios na conclusão) */}
            {!['entregue','nao_entregue'].includes(selected.status) && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold text-blue-700 uppercase">Controle de Tubos</p>

                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-2">Houve recolhimento de tubo?</p>
                  <div className="flex gap-2">
                    {[['1','Sim'],['0','Não']].map(([v, l]) => (
                      <button key={v} type="button"
                        onClick={() => setForm(p => ({ ...p, tubes_had: v }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${form.tubes_had === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {form.tubes_had === '1' && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-blue-600">Quantidade recolhida:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-blue-500 block mb-1">P5 (R$ 0,50 cada)</label>
                        <input type="number" min="0" inputMode="numeric"
                          value={form.tubes_qty_p5}
                          onChange={e => setForm(p => ({ ...p, tubes_qty_p5: e.target.value }))}
                          className="input text-center text-lg font-bold" />
                      </div>
                      <div>
                        <label className="text-xs text-blue-500 block mb-1">P10 (R$ 1,00 cada)</label>
                        <input type="number" min="0" inputMode="numeric"
                          value={form.tubes_qty_p10}
                          onChange={e => setForm(p => ({ ...p, tubes_qty_p10: e.target.value }))}
                          className="input text-center text-lg font-bold" />
                      </div>
                    </div>
                    {(parseInt(form.tubes_qty_p5)||0)+(parseInt(form.tubes_qty_p10)||0) > 0 && (
                      <div className="bg-blue-100 rounded-lg px-3 py-2 text-center text-sm font-bold text-blue-800">
                        Total: {(parseInt(form.tubes_qty_p5)||0) + (parseInt(form.tubes_qty_p10)||0)} tubos ·{' '}
                        {((parseInt(form.tubes_qty_p5)||0)*0.50 + (parseInt(form.tubes_qty_p10)||0)*1.00).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-2">Ficou pendência de tubo?</p>
                  <div className="flex gap-2">
                    {[['1','Sim'],['0','Não']].map(([v, l]) => (
                      <button key={v} type="button"
                        onClick={() => setForm(p => ({ ...p, tubes_pending: v }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${form.tubes_pending === v ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {form.tubes_pending === '1' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-red-500 block mb-1">Pendente P5</label>
                      <input type="number" min="0" inputMode="numeric"
                        value={form.tubes_pending_p5}
                        onChange={e => setForm(p => ({ ...p, tubes_pending_p5: e.target.value }))}
                        className="input text-center" />
                    </div>
                    <div>
                      <label className="text-xs text-red-500 block mb-1">Pendente P10</label>
                      <input type="number" min="0" inputMode="numeric"
                        value={form.tubes_pending_p10}
                        onChange={e => setForm(p => ({ ...p, tubes_pending_p10: e.target.value }))}
                        className="input text-center" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-blue-500 block mb-1">Observação sobre tubos (opcional)</label>
                  <input type="text" value={form.tubes_obs}
                    onChange={e => setForm(p => ({ ...p, tubes_obs: e.target.value }))}
                    className="input" placeholder="Ex: cliente separou mas não entregou..." />
                </div>
              </div>
            )}

            {/* Upload canhoto (obrigatório na conclusão) */}
            {!['entregue','nao_entregue'].includes(selected.status) && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                  Foto do Canhoto <span className="text-red-500">*</span>
                </p>
                <label className="block">
                  <div className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${photos.length > 0 ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50'}`}>
                    {photos.length > 0 ? (
                      <>
                        <div className="text-2xl mb-1">✅</div>
                        <p className="text-sm font-bold text-green-700">{photos.length} foto(s) selecionada(s)</p>
                        <p className="text-xs text-green-600 mt-0.5">Toque para alterar</p>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl mb-1">📷</div>
                        <p className="text-sm font-semibold text-slate-600">Fotografar ou selecionar canhoto</p>
                        <p className="text-xs text-slate-400 mt-0.5">JPG, PNG — obrigatório para concluir</p>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
                    className="hidden"
                    onChange={e => setPhotos(Array.from(e.target.files))} />
                </label>

                {/* Fotos existentes */}
                {(selected.canhoto_photos?.length > 0 || selected.canhoto_photo) && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 mb-1">Já enviados:</p>
                    <div className="flex gap-2 flex-wrap">
                      {selected.canhoto_photo && (
                        <button type="button" onClick={() => setLightboxUrl(photoSrc(selected.canhoto_photo))}
                          className="block w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-brand-400 transition-all">
                          <img src={photoSrc(selected.canhoto_photo)} alt="canhoto" className="w-full h-full object-cover" />
                        </button>
                      )}
                      {selected.canhoto_photos?.map((p, i) => (
                        <button key={i} type="button" onClick={() => setLightboxUrl(photoSrc(p.filename))}
                          className="block w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-brand-400 transition-all">
                          <img src={photoSrc(p.filename)} alt={`canhoto ${i+1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Observações */}
            {!['entregue','nao_entregue'].includes(selected.status) && (
              <div>
                <label className="label">Observações (opcional)</label>
                <textarea value={form.observations}
                  onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
                  className="input" rows={2} placeholder="Ocorrências, anotações..." />
              </div>
            )}

            {/* Erros */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                {errors.map((msg, i) => (
                  <p key={i} className="text-xs text-red-700 font-medium">• {msg}</p>
                ))}
              </div>
            )}

            {/* Botão de conclusão (validado) */}
            {!['entregue','nao_entregue','ocorrencia'].includes(selected.status) && (
              <button type="button"
                onClick={() => handleStatus('entregue')}
                disabled={saving}
                className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-black text-base transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : '✅ Confirmar Entrega'}
              </button>
            )}

            {/* Não consegui entregar */}
            {!['entregue','nao_entregue','ocorrencia'].includes(selected.status) && (
              <button type="button"
                onClick={() => { setFailModal(selected); setFailReason('') }}
                className="w-full py-3 rounded-xl border-2 border-red-300 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors">
                ❌ Não Consegui Entregar
              </button>
            )}

            {/* Exibição do histórico quando já concluída */}
            {['entregue','nao_entregue','ocorrencia'].includes(selected.status) && (
              <div className="space-y-2">
                {selected.tubes_had ? (
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-700 uppercase mb-2">Tubos Recolhidos</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div><div className="font-black text-blue-800">{selected.tubes_qty_p5||0}</div><div className="text-xs text-blue-500">P5</div></div>
                      <div><div className="font-black text-blue-800">{selected.tubes_qty_p10||0}</div><div className="text-xs text-blue-500">P10</div></div>
                      <div><div className="font-black text-blue-900">{(selected.tubes_qty_p5||0)+(selected.tubes_qty_p10||0)}</div><div className="text-xs text-blue-500">Total</div></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 text-center">Nenhum tubo recolhido</div>
                )}
                {/* Foto do canhoto / comprovante */}
                {(selected.canhoto_photo || selected.delivery_proof_url || selected.canhoto_photos?.length > 0) && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Comprovante</p>
                    <div className="flex gap-2 flex-wrap">
                      {[selected.canhoto_photo, selected.delivery_proof_url].filter(Boolean).map((url, i) => (
                        <button key={i} type="button" onClick={() => setLightboxUrl(photoSrc(url))}
                          className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-brand-400 transition-all">
                          <img src={photoSrc(url)} alt="comprovante" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {selected.canhoto_photos?.map((p, i) => (
                        <button key={`cp${i}`} type="button" onClick={() => setLightboxUrl(photoSrc(p.filename))}
                          className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-brand-400 transition-all">
                          <img src={photoSrc(p.filename)} alt={`canhoto ${i+1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selected.observations && (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 italic">"{selected.observations}"</div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Lightbox ──────────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          style={{ touchAction: 'none' }}>
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white text-3xl font-bold leading-none">
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="Foto"
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
        </div>
      )}

      {/* ── Modal: Não consegui entregar ──────────────────────────────────── */}
      <Modal open={!!failModal} onClose={() => setFailModal(null)} title="Registrar Tentativa Falha">
        {failModal && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-bold text-slate-800">{failModal.client_name}</div>
              {failModal.address && <div className="text-xs text-slate-500">{failModal.address}</div>}
            </div>
            <div>
              <label className="label">Motivo da tentativa falha <span className="text-red-500">*</span></label>
              <textarea value={failReason} onChange={e => setFailReason(e.target.value)}
                className="input" rows={3}
                placeholder="Ex: cliente ausente, endereço errado, portão fechado..." />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
              O pedido voltará para a lista de disponíveis para outro motorista tentar.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFailModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleAttemptFailed} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-50">
                {saving ? 'Registrando...' : 'Confirmar Tentativa Falha'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
