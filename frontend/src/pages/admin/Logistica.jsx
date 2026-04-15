import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

// Badge de status financeiro dos tubos
function PaymentBadge({ status }) {
  if (!status || status === 'pendente')
    return <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">💰 Pendente</span>
  if (status === 'pago')
    return <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">✅ Pago</span>
  if (status === 'isento')
    return <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">— Isento</span>
  return null
}

// Card resumo de tubos numa entrega
function TubesSummary({ d, compact = false }) {
  const p5  = d.tubes_p5  || d.tubes_qty_p5  || 0
  const p10 = d.tubes_p10 || d.tubes_qty_p10 || 0
  const total = p5 + p10
  if (!d.tubes_had && total === 0) return null
  const valP5    = (p5  * 0.50).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const valP10   = (p10 * 1.00).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const valTotal = ((p5 * 0.50) + (p10 * 1.00)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (compact) return (
    <div className="flex flex-wrap gap-1 mt-1">
      {total > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">🔄 {total} tubos (P5:{p5} P10:{p10}) · {valTotal}</span>}
      {d.tubes_pending ? <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">⚠ pendente</span> : null}
      <PaymentBadge status={d.tubes_payment_status} />
    </div>
  )
  return (
    <div className="bg-blue-50 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-blue-700 uppercase">Tubos Recolhidos</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-black text-blue-800">{p5}</div>
          <div className="text-xs text-blue-500">P5</div>
          <div className="text-xs font-semibold text-blue-600">{valP5}</div>
        </div>
        <div>
          <div className="text-lg font-black text-blue-800">{p10}</div>
          <div className="text-xs text-blue-500">P10</div>
          <div className="text-xs font-semibold text-blue-600">{valP10}</div>
        </div>
        <div>
          <div className="text-lg font-black text-blue-900">{total}</div>
          <div className="text-xs text-blue-500">Total</div>
          <div className="text-xs font-bold text-blue-800">{valTotal}</div>
        </div>
      </div>
      {d.tubes_pending ? (
        <div className="bg-red-50 rounded-lg px-3 py-1.5 text-xs text-red-700">
          ⚠ Pendente: P5={d.tubes_pending_p5 || 0} · P10={d.tubes_pending_p10 || 0}
        </div>
      ) : null}
      {d.tubes_obs ? <p className="text-xs text-blue-600 italic">"{d.tubes_obs}"</p> : null}
    </div>
  )
}

function CanhotoStatus({ d }) {
  const count = d.photo_count || (d.canhoto_photo ? 1 : 0) || (d.canhoto_photos?.length ?? 0)
  if (count > 0)
    return <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">📄 {count} foto(s)</span>
  if (d.no_proof_reason)
    return <span className="text-xs bg-yellow-50 text-yellow-700 font-bold px-2 py-0.5 rounded-full">📋 Justificado</span>
  return <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Sem canhoto</span>
}

export default function AdminLogistica() {
  const [searchParams] = useSearchParams()
  const [tab, setTab]             = useState(searchParams.get('tab') || 'expedicao')
  const [readyOrders, setReadyOrders] = useState([])
  const [deliveries, setDeliveries]   = useState([])
  const [drivers, setDrivers]         = useState([])
  const [vehicles, setVehicles]       = useState([])
  const [canhotos, setCanhotos]       = useState([])
  const [tubesReport, setTubesReport] = useState(null)
  const [canhotoFilter, setCanhotoFilter] = useState('')
  const [canhotoDriver, setCanhotoDriver] = useState('')
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState({ driver_id: '', vehicle_id: '' })
  const [loading, setLoading]     = useState(false)
  const [payLoading, setPayLoading] = useState(null)
  const [error, setError]         = useState('')
  const [delModal, setDelModal]   = useState(null)
  const [adminLaunch, setAdminLaunch] = useState(null)
  const [adminForm, setAdminForm] = useState({})
  const [adminFiles, setAdminFiles] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminErrors, setAdminErrors] = useState([])
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const adminFileRef = useRef(null)

  // Monta URL segura para imagens
  const photoSrc = (raw) => {
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    if (raw.startsWith('/')) return raw
    return `/uploads/${raw}`
  }

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

  const loadCanhotos = async () => {
    const params = {}
    if (canhotoFilter !== '') params.has_canhoto = canhotoFilter
    if (canhotoDriver)        params.driver_id   = canhotoDriver
    const r = await api.get('/deliveries/reports/canhotos', { params })
    setCanhotos(r.data)
  }

  const loadTubes = async () => {
    const r = await api.get('/deliveries/reports/tubes')
    setTubesReport(r.data)
  }

  useEffect(() => { loadAll() }, [])
  // Polling de 10s na aba expedição para capturar novos pedidos DISPONIVEL
  useEffect(() => {
    const id = setInterval(() => { if (tab === 'expedicao' || tab === 'em_rota') loadAll() }, 10000)
    return () => clearInterval(id)
  }, [tab])
  useEffect(() => { if (tab === 'canhotos') loadCanhotos() }, [tab, canhotoFilter, canhotoDriver])
  useEffect(() => { if (tab === 'tubos') loadTubes() }, [tab])

  const openAssign = (order) => { setSelected(order); setForm({ driver_id: '', vehicle_id: '' }); setError('') }

  const markPayment = async (deliveryId, status) => {
    setPayLoading(deliveryId)
    try {
      await api.patch(`/deliveries/${deliveryId}/payment`, { payment_status: status })
      await loadAll()
      // Atualiza o delModal se estiver aberto
      if (delModal?.id === deliveryId) setDelModal(d => ({ ...d, tubes_payment_status: status }))
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao atualizar pagamento')
    } finally {
      setPayLoading(null)
    }
  }

  const openAdminLaunch = (d) => {
    setAdminLaunch(d)
    setAdminForm({
      status: d.status,
      driver_id: d.driver_id,
      tubes_had: d.tubes_had != null ? String(d.tubes_had) : '',
      tubes_qty_p5: d.tubes_p5 || 0,
      tubes_qty_p10: d.tubes_p10 || 0,
      tubes_pending: d.tubes_pending != null ? String(d.tubes_pending) : '',
      tubes_pending_p5: d.tubes_pending_p5 || 0,
      tubes_pending_p10: d.tubes_pending_p10 || 0,
      tubes_obs: d.tubes_obs || '',
      observations: d.observations || '',
    })
    setAdminFiles([])
    setAdminErrors([])
  }

  const handleAdminLaunch = async (targetStatus) => {
    setAdminLoading(true)
    setAdminErrors([])
    try {
      const fd = new FormData()
      fd.append('status', targetStatus)
      fd.append('driver_id', adminForm.driver_id || adminLaunch.driver_id)
      if (adminForm.tubes_had !== '') fd.append('tubes_had', adminForm.tubes_had)
      fd.append('tubes_qty_p5', adminForm.tubes_qty_p5 || 0)
      fd.append('tubes_qty_p10', adminForm.tubes_qty_p10 || 0)
      if (adminForm.tubes_pending !== '') fd.append('tubes_pending', adminForm.tubes_pending)
      fd.append('tubes_pending_p5', adminForm.tubes_pending_p5 || 0)
      fd.append('tubes_pending_p10', adminForm.tubes_pending_p10 || 0)
      if (adminForm.tubes_obs) fd.append('tubes_obs', adminForm.tubes_obs)
      if (adminForm.observations) fd.append('observations', adminForm.observations)
      for (const f of adminFiles) fd.append('canhoto_photos', f)
      await api.put(`/deliveries/${adminLaunch.id}/status`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadAll()
      setAdminLaunch(null)
    } catch (e) {
      const msgs = e.response?.data?.messages || [e.response?.data?.error || 'Erro ao atualizar entrega']
      setAdminErrors(msgs)
    } finally {
      setAdminLoading(false)
    }
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

  const inTransit  = deliveries.filter(d => ['pendente','saiu_entrega','chegou_cliente'].includes(d.status))
  const completed  = deliveries.filter(d => ['entregue','nao_entregue','ocorrencia'].includes(d.status))

  const TABS = [
    { key: 'expedicao', label: `Expedição (${readyOrders.length})` },
    { key: 'em_rota',   label: `Em Rota (${inTransit.length})` },
    { key: 'historico', label: `Histórico (${completed.length})` },
    { key: 'canhotos',  label: 'Canhotos' },
    { key: 'tubos',     label: 'Tubos' },
  ]

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Expedição ─────────────────────────────────────────────── */}
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
                  {o.items?.slice(0, 3).map((item, i) => (
                    <div key={i} className="text-xs text-slate-500">{item.quantity}x {item.sku_name}</div>
                  ))}
                  {o.items?.length > 3 && <div className="text-xs text-slate-400">+{o.items.length - 3} item(s)...</div>}
                </div>
                <button onClick={() => openAssign(o)} className="btn-primary text-xs flex-shrink-0">🚚 Enviar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Em Rota ───────────────────────────────────────────────── */}
      {tab === 'em_rota' && (
        <div className="space-y-2">
          {inTransit.length === 0 && (
            <div className="card p-10 text-center text-slate-400">
              <div className="text-4xl mb-2">🚚</div>
              <p className="font-medium">Nenhuma entrega em rota agora</p>
            </div>
          )}
          {inTransit.map(d => (
            <button key={d.id} onClick={() => openAdminLaunch(d)} className="card p-4 w-full text-left hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 truncate">{d.client_name}</div>
                  <div className="text-xs text-slate-500 truncate">{d.address}, {d.city}</div>
                  <div className="text-xs text-slate-400 mt-1">Motorista: {d.driver_name} · {d.plate || 'sem veículo'}</div>
                  <div className="mt-2"><StatusBadge status={d.status} /></div>
                </div>
                <span className="text-brand-500 text-lg">›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Histórico ─────────────────────────────────────────────── */}
      {tab === 'historico' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{completed.length} entrega(s) finalizada(s)</p>
          {completed.map(d => (
            <div key={d.id} className="card p-4 space-y-3">
              {/* Cabeçalho clicável */}
              <button onClick={() => setDelModal(d)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{d.client_name}</div>
                    <div className="text-xs text-slate-500">{d.driver_name} · {d.city}</div>
                    {d.completion_time && (
                      <div className="text-xs text-slate-400">{new Date(d.completion_time).toLocaleString('pt-BR')}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusBadge status={d.status} />
                    <CanhotoStatus d={d} />
                  </div>
                </div>
              </button>

              {/* Tubos + financeiro (só se tiver tubos) */}
              {(d.tubes_had || (d.tubes_p5 || 0) + (d.tubes_p10 || 0) > 0) && (
                <div className="border-t border-slate-100 pt-2 space-y-2">
                  {/* Linha de totais */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500">Tubos:</span>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                      P5: {d.tubes_p5 || d.tubes_qty_p5 || 0}
                    </span>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                      P10: {d.tubes_p10 || d.tubes_qty_p10 || 0}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                      Total: {(d.tubes_p5 || d.tubes_qty_p5 || 0) + (d.tubes_p10 || d.tubes_qty_p10 || 0)}
                    </span>
                    {d.tubes_pending ? (
                      <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full">⚠ pendente</span>
                    ) : null}
                  </div>

                  {/* Controle financeiro */}
                  <div className="flex items-center justify-between gap-2">
                    <PaymentBadge status={d.tubes_payment_status} />
                    <div className="flex gap-1">
                      {d.tubes_payment_status !== 'pago' && (
                        <button
                          onClick={() => markPayment(d.id, 'pago')}
                          disabled={payLoading === d.id}
                          className="text-xs bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {payLoading === d.id ? '...' : '✅ Marcar como pago'}
                        </button>
                      )}
                      {d.tubes_payment_status === 'pago' && (
                        <button
                          onClick={() => markPayment(d.id, 'pendente')}
                          disabled={payLoading === d.id}
                          className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Desfazer
                        </button>
                      )}
                      {d.tubes_payment_status !== 'isento' && (
                        <button
                          onClick={() => markPayment(d.id, 'isento')}
                          disabled={payLoading === d.id}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Isento
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {completed.length === 0 && <div className="text-center py-8 text-slate-400">Nenhuma entrega finalizada</div>}
        </div>
      )}

      {/* ── Canhotos ──────────────────────────────────────────────── */}
      {tab === 'canhotos' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <select value={canhotoFilter} onChange={e => setCanhotoFilter(e.target.value)} className="input text-sm py-2 flex-1 min-w-[140px]">
              <option value="">Todos</option>
              <option value="1">Com canhoto</option>
              <option value="0">Sem canhoto</option>
            </select>
            <select value={canhotoDriver} onChange={e => setCanhotoDriver(e.target.value)} className="input text-sm py-2 flex-1 min-w-[140px]">
              <option value="">Todos motoristas</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Com canhoto', val: canhotos.filter(c => c.photo_count > 0 || c.canhoto_photo).length, color: 'text-green-600' },
              { label: 'Justificado', val: canhotos.filter(c => c.no_proof_reason && !c.canhoto_photo && c.photo_count === 0).length, color: 'text-yellow-600' },
              { label: 'Sem nada',    val: canhotos.filter(c => !c.canhoto_photo && c.photo_count === 0 && !c.no_proof_reason).length, color: 'text-red-600' },
            ].map(k => (
              <div key={k.label} className="card p-3 text-center">
                <div className={`text-xl font-black ${k.color}`}>{k.val}</div>
                <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {canhotos.map(c => (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{c.client_name}</div>
                    <div className="text-xs text-slate-500">{c.driver_name} · {c.city}</div>
                    {c.completion_time && (
                      <div className="text-xs text-slate-400">{new Date(c.completion_time).toLocaleString('pt-BR')}</div>
                    )}
                    {c.no_proof_reason && (
                      <div className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-1 truncate">
                        Motivo: {c.no_proof_reason}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusBadge status={c.status} />
                    <CanhotoStatus d={c} />
                  </div>
                </div>
                {/* Links das fotos */}
                {(c.photo_count > 0 || c.canhoto_photo || c.delivery_proof_url) && (
                  <div className="mt-2 flex gap-2 flex-wrap items-center">
                    {[c.canhoto_photo, c.delivery_proof_url].filter(Boolean).map((url, i) => (
                      <button key={i} type="button" onClick={() => setLightboxUrl(photoSrc(url))}
                        className="w-14 h-14 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-brand-400 transition-all flex-shrink-0">
                        <img src={photoSrc(url)} alt={`canhoto ${i+1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {c.photo_count > 0 && (
                      <button
                        onClick={async () => {
                          const r = await api.get(`/deliveries/${c.id}/photos`)
                          if (r.data?.[0]) setLightboxUrl(photoSrc(r.data[0].filename))
                        }}
                        className="text-xs text-brand-600 underline"
                      >
                        Ver {c.photo_count} foto(s)
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {canhotos.length === 0 && <div className="text-center py-8 text-slate-400">Nenhuma entrega encontrada</div>}
          </div>
        </div>
      )}

      {/* ── Tubos ─────────────────────────────────────────────────── */}
      {tab === 'tubos' && tubesReport && (
        <div className="space-y-4">
          {/* Resumo financeiro geral */}
          {(() => {
            const allDelivs = deliveries.filter(d => (d.tubes_p5 || 0) + (d.tubes_p10 || 0) > 0)
            const pendVal = allDelivs.filter(d => d.tubes_payment_status !== 'pago' && d.tubes_payment_status !== 'isento')
              .reduce((acc, d) => acc + (d.tubes_value_total || ((d.tubes_p5||0)*0.50 + (d.tubes_p10||0)*1.00)), 0)
            const paidVal = allDelivs.filter(d => d.tubes_payment_status === 'pago')
              .reduce((acc, d) => acc + (d.tubes_value_total || ((d.tubes_p5||0)*0.50 + (d.tubes_p10||0)*1.00)), 0)
            return (
              <div className="grid grid-cols-2 gap-2">
                <div className="card p-3 text-center border-l-4 border-red-400">
                  <div className="text-lg font-black text-red-600">{pendVal.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Pendente de pagamento</div>
                </div>
                <div className="card p-3 text-center border-l-4 border-green-400">
                  <div className="text-lg font-black text-green-600">{paidVal.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Já pago</div>
                </div>
              </div>
            )
          })()}
          {/* Por motorista */}
          {tubesReport.by_driver?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-bold text-slate-700 text-sm mb-3">Por Motorista</h3>
              <div className="space-y-3">
                {tubesReport.by_driver.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{d.driver_name}</div>
                      <div className="text-xs text-slate-400">{d.routes_with_tubes} rota(s) com tubo</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-blue-700">{d.total_collected} recolhidos</div>
                      {d.total_value > 0 && (
                        <div className="text-xs font-bold text-blue-600">{Number(d.total_value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                      )}
                      {d.total_pending > 0 && (
                        <div className="text-xs font-bold text-red-600">{d.total_pending} pendentes</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pendências abertas */}
          {tubesReport.pending_open?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-bold text-red-600 text-sm mb-3">⚠ Pendências de Tubo em Aberto</h3>
              <div className="space-y-2">
                {tubesReport.pending_open.map((d, i) => (
                  <div key={i} className="bg-red-50 rounded-xl p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-sm">{d.client_name}</div>
                        <div className="text-xs text-slate-500">{d.driver_name}</div>
                        {d.tubes_obs && <div className="text-xs text-slate-600 mt-1">{d.tubes_obs}</div>}
                      </div>
                      <span className="text-sm font-black text-red-600 flex-shrink-0">{d.tubes_pending_qty} un</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Por cliente */}
          {tubesReport.by_client?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-bold text-slate-700 text-sm mb-3">Por Cliente</h3>
              <div className="space-y-2">
                {tubesReport.by_client.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate">{c.client_name}</div>
                      <div className="text-xs text-slate-400">{c.city}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-blue-700">{c.total_collected} recolhidos</div>
                      {c.total_pending > 0 && (
                        <div className="text-xs text-red-600 font-bold">{c.total_pending} pendentes</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!tubesReport.by_driver?.length && !tubesReport.pending_open?.length && (
            <div className="text-center py-10 text-slate-400">
              <div className="text-4xl mb-2">🔄</div>
              <p>Nenhum dado de tubos registrado ainda.</p>
            </div>
          )}
        </div>
      )}
      {tab === 'tubos' && !tubesReport && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent"/>
        </div>
      )}

      {/* ── Modal: Admin lançar entrega ──────────────────────────── */}
      <Modal open={!!adminLaunch} onClose={() => setAdminLaunch(null)} title="Lançar Entrega (Admin)">
        {adminLaunch && (
          <div className="space-y-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-bold text-slate-800">{adminLaunch.client_name}</div>
              <div className="text-xs text-slate-500">{adminLaunch.address}, {adminLaunch.city}</div>
              <StatusBadge status={adminLaunch.status} />
              {adminLaunch.acted_by_role === 'admin' && (
                <div className="mt-1 text-xs text-orange-600 font-semibold">Lançado pelo administrador</div>
              )}
            </div>

            {/* Reatribuir motorista */}
            <div>
              <label className="label">Motorista</label>
              <select value={adminForm.driver_id} onChange={e => setAdminForm(p => ({...p, driver_id: e.target.value}))} className="input">
                <option value="">Selecione...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Tubos */}
            <div className="bg-blue-50 rounded-xl p-3 space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase">Tubos Recolhidos</p>
              <div>
                <label className="label text-blue-700">Houve recolhimento?</label>
                <div className="flex gap-2">
                  {[['1','Sim'],['0','Não']].map(([v,l]) => (
                    <button key={v} type="button"
                      onClick={() => setAdminForm(p => ({...p, tubes_had: v}))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${adminForm.tubes_had === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >{l}</button>
                  ))}
                </div>
              </div>
              {adminForm.tubes_had === '1' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">P5 (R$ 0,50)</label>
                    <input type="number" min="0" value={adminForm.tubes_qty_p5} onChange={e => setAdminForm(p => ({...p, tubes_qty_p5: e.target.value}))} className="input" />
                  </div>
                  <div>
                    <label className="label">P10 (R$ 1,00)</label>
                    <input type="number" min="0" value={adminForm.tubes_qty_p10} onChange={e => setAdminForm(p => ({...p, tubes_qty_p10: e.target.value}))} className="input" />
                  </div>
                </div>
              )}
              <div>
                <label className="label text-blue-700">Ficou pendência?</label>
                <div className="flex gap-2">
                  {[['1','Sim'],['0','Não']].map(([v,l]) => (
                    <button key={v} type="button"
                      onClick={() => setAdminForm(p => ({...p, tubes_pending: v}))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${adminForm.tubes_pending === v ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200'}`}
                    >{l}</button>
                  ))}
                </div>
              </div>
              {adminForm.tubes_pending === '1' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Pendente P5</label>
                    <input type="number" min="0" value={adminForm.tubes_pending_p5} onChange={e => setAdminForm(p => ({...p, tubes_pending_p5: e.target.value}))} className="input" />
                  </div>
                  <div>
                    <label className="label">Pendente P10</label>
                    <input type="number" min="0" value={adminForm.tubes_pending_p10} onChange={e => setAdminForm(p => ({...p, tubes_pending_p10: e.target.value}))} className="input" />
                  </div>
                </div>
              )}
              <div>
                <label className="label">Observação de tubos</label>
                <input type="text" value={adminForm.tubes_obs} onChange={e => setAdminForm(p => ({...p, tubes_obs: e.target.value}))} className="input" placeholder="Opcional..." />
              </div>
            </div>

            {/* Canhoto */}
            <div>
              <label className="label">Foto(s) do canhoto</label>
              <input ref={adminFileRef} type="file" accept="image/*" multiple capture="environment"
                onChange={e => setAdminFiles(Array.from(e.target.files))}
                className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:font-semibold hover:file:bg-brand-100" />
              {adminFiles.length > 0 && <p className="text-xs text-green-600 mt-1">{adminFiles.length} foto(s) selecionada(s)</p>}
            </div>

            {/* Observações */}
            <div>
              <label className="label">Observações</label>
              <textarea value={adminForm.observations} onChange={e => setAdminForm(p => ({...p, observations: e.target.value}))} className="input" rows={2} placeholder="Opcional..." />
            </div>

            {/* Erros */}
            {adminErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                {adminErrors.map((msg, i) => <p key={i} className="text-xs text-red-700">• {msg}</p>)}
              </div>
            )}

            {/* Botões de status */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Atualizar Status</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { s: 'saiu_entrega',   label: '🚚 Saiu p/ Entrega' },
                  { s: 'chegou_cliente', label: '📍 Chegou no Cliente' },
                  { s: 'ocorrencia',     label: '⚠ Ocorrência' },
                  { s: 'entregue',       label: '✅ Concluir Entrega' },
                ].map(({ s, label }) => (
                  <button key={s} type="button"
                    onClick={() => handleAdminLaunch(s)}
                    disabled={adminLoading}
                    className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${
                      s === 'entregue' ? 'bg-green-500 text-white border-green-500 hover:bg-green-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >{adminLoading ? '...' : label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Atribuir motorista ─────────────────────────────── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Enviar Pedido #${selected?.id}`}>
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="font-bold text-slate-800">{selected.client_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{selected.address}, {selected.city}</div>
              {selected.items?.map((item, i) => (
                <div key={i} className="text-xs text-slate-600">{item.quantity}x {item.sku_name}</div>
              ))}
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

      {/* ── Modal: Detalhe entrega (admin) ───────────────────────── */}
      <Modal open={!!delModal} onClose={() => setDelModal(null)} title="Detalhes da Entrega">
        {delModal && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-500 text-xs block">Cliente</span><span className="font-semibold">{delModal.client_name}</span></div>
              <div><span className="text-slate-500 text-xs block">Motorista</span><span className="font-semibold">{delModal.driver_name}</span></div>
              <div><span className="text-slate-500 text-xs block">Veículo</span><span className="font-semibold">{delModal.plate || '—'}</span></div>
              <div><span className="text-slate-500 text-xs block">Status</span><StatusBadge status={delModal.status} /></div>
              {delModal.departure_time  && <div><span className="text-slate-500 text-xs block">Saída</span><span>{new Date(delModal.departure_time).toLocaleTimeString('pt-BR')}</span></div>}
              {delModal.completion_time && <div><span className="text-slate-500 text-xs block">Conclusão</span><span>{new Date(delModal.completion_time).toLocaleTimeString('pt-BR')}</span></div>}
            </div>

            {/* Tubos detalhado */}
            <TubesSummary d={delModal} />

            {/* Controle financeiro no modal */}
            {(delModal.tubes_had || (delModal.tubes_p5 || 0) + (delModal.tubes_p10 || 0) > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Status Financeiro dos Tubos</p>
                <div className="flex items-center justify-between gap-2">
                  <PaymentBadge status={delModal.tubes_payment_status} />
                  <div className="flex gap-1.5">
                    {delModal.tubes_payment_status !== 'pago' && (
                      <button onClick={() => markPayment(delModal.id, 'pago')} disabled={payLoading === delModal.id}
                        className="text-xs bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg disabled:opacity-50">
                        {payLoading === delModal.id ? '...' : '✅ Marcar pago'}
                      </button>
                    )}
                    {delModal.tubes_payment_status === 'pago' && (
                      <button onClick={() => markPayment(delModal.id, 'pendente')} disabled={payLoading === delModal.id}
                        className="text-xs bg-slate-200 text-slate-600 font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                        Desfazer
                      </button>
                    )}
                    {delModal.tubes_payment_status !== 'isento' && (
                      <button onClick={() => markPayment(delModal.id, 'isento')} disabled={payLoading === delModal.id}
                        className="text-xs bg-slate-100 text-slate-500 font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                        Isento
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Canhoto */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Comprovante</p>
              <div className="flex flex-wrap gap-2">
                {delModal.canhoto_photo && (
                  <button type="button" onClick={() => setLightboxUrl(photoSrc(delModal.canhoto_photo))}
                    className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-brand-400 transition-all">
                    <img src={photoSrc(delModal.canhoto_photo)} alt="canhoto" className="w-full h-full object-cover" />
                  </button>
                )}
                {delModal.delivery_proof_url && delModal.delivery_proof_url !== delModal.canhoto_photo && (
                  <button type="button" onClick={() => setLightboxUrl(photoSrc(delModal.delivery_proof_url))}
                    className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-brand-400 transition-all">
                    <img src={photoSrc(delModal.delivery_proof_url)} alt="comprovante" className="w-full h-full object-cover" />
                  </button>
                )}
                {delModal.canhoto_photos?.map((p, i) => (
                  <button key={i} type="button" onClick={() => setLightboxUrl(photoSrc(p.filename))}
                    className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-brand-400 transition-all">
                    <img src={photoSrc(p.filename)} alt={`canhoto ${i+1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
                {!delModal.canhoto_photo && !delModal.delivery_proof_url && !delModal.canhoto_photos?.length && (
                  <span className="text-xs text-slate-400">Nenhum comprovante enviado</span>
                )}
              </div>
              {delModal.no_proof_reason && (
                <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
                  <strong>Justificativa:</strong> {delModal.no_proof_reason}
                </div>
              )}
            </div>

            {delModal.observations && <div className="bg-slate-50 rounded-lg p-2 text-xs text-slate-600">{delModal.observations}</div>}
            {delModal.occurrence   && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800"><strong>Ocorrência:</strong> {delModal.occurrence}</div>}

            {delModal.items?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Itens entregues</p>
                {delModal.items.map((item, i) => (
                  <div key={i} className="text-xs text-slate-700">{item.quantity}x {item.sku_name}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white text-3xl font-bold leading-none z-10">
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="Comprovante"
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  )
}
