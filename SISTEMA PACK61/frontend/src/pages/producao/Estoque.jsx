import { useState, useEffect } from 'react'
import api from '../../api'
import Modal from '../../components/Modal'

const EMPTY_SKU = { code: '', name: '', category: '', type: '', weight: '', unit: 'RL', min_stock: '', observations: '' }
const TYPES = ['manual', 'automatico', 'manual_sem_tubo', 'fita_adesiva', 'outro']
const MOV_TYPES = [
  { value: 'entrada',  label: 'Entrada de estoque' },
  { value: 'producao', label: 'Entrada de produção' },
  { value: 'saida',    label: 'Saída manual' },
  { value: 'ajuste',   label: 'Ajuste (valor exato)' },
  { value: 'perda',    label: 'Perda' },
  { value: 'avaria',   label: 'Avaria' },
]

function StockBar({ physical, reserved, available, minStock }) {
  if (!physical || physical === 0) return (
    <div className="h-2 rounded-full bg-slate-100 mt-1">
      <div className="h-2 rounded-full bg-red-400" style={{ width: '100%' }} />
    </div>
  )
  const reservedPct = Math.min(100, (reserved / physical) * 100)
  const availPct = Math.min(100, (available / physical) * 100)
  const isLow = available <= minStock
  return (
    <div className="mt-1.5">
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
        <div
          className={`h-full transition-all ${isLow ? 'bg-red-400' : 'bg-green-400'}`}
          style={{ width: `${availPct}%` }}
        />
        <div className="h-full bg-yellow-400 transition-all" style={{ width: `${reservedPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-0.5">
        <span className={isLow ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
          {available} disponível
        </span>
        {reserved > 0 && <span className="text-yellow-600">{reserved} reservado</span>}
      </div>
    </div>
  )
}

export default function Estoque() {
  const [summary, setSummary] = useState(null)
  const [skus, setSkus] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_SKU)
  const [editing, setEditing] = useState(null)
  const [movModal, setMovModal] = useState(false)
  const [movSku, setMovSku] = useState(null)
  const [reservations, setReservations] = useState([])
  const [showReservations, setShowReservations] = useState(false)
  const [mov, setMov] = useState({ type: 'entrada', quantity: '', reason: '' })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const r = await api.get('/stock/summary')
    setSummary(r.data.totals)
    setSkus(r.data.skus)
  }
  useEffect(() => { load() }, [])

  const filtered = skus.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
    const matchStatus =
      filterStatus === 'todos' ||
      (filterStatus === 'ok' && s.stock_status === 'ok') ||
      (filterStatus === 'baixo' && s.stock_status === 'baixo') ||
      (filterStatus === 'critico' && s.stock_status === 'critico')
    return matchSearch && matchStatus
  })

  const openCreate = () => { setForm(EMPTY_SKU); setEditing(null); setModal(true) }
  const openEdit = (s) => {
    setForm({ ...s, min_stock: s.min_stock ?? '' })
    setEditing(s.id); setModal(true)
  }
  const openMov = async (s) => {
    setMovSku(s)
    setMov({ type: 'entrada', quantity: '', reason: '' })
    setShowReservations(false)
    setMovModal(true)
    const r = await api.get(`/stock/reservations/${s.id}`)
    setReservations(r.data)
  }

  const handleSaveSku = async () => {
    setLoading(true)
    try {
      if (editing) await api.put(`/stock/skus/${editing}`, form)
      else await api.post('/stock/skus', form)
      await load(); setModal(false)
    } catch (e) { alert(e.response?.data?.error || 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  const handleMov = async () => {
    if (!mov.quantity) return alert('Informe a quantidade')
    setLoading(true)
    try {
      await api.post('/stock/movements', { sku_id: movSku.id, ...mov })
      await load(); setMovModal(false)
    } catch (e) { alert(e.response?.data?.error || 'Erro') }
    finally { setLoading(false) }
  }

  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const countByStatus = (s) => skus.filter(x => x.stock_status === s).length

  return (
    <div className="space-y-4">

      {/* ── Resumo totais ─────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3 text-center">
            <div className="text-lg font-black text-slate-800">{summary.total_physical}</div>
            <div className="text-xs text-slate-400">Físico</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-black text-yellow-600">{summary.total_reserved}</div>
            <div className="text-xs text-slate-400">Reservado</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-black text-green-600">{summary.total_available}</div>
            <div className="text-xs text-slate-400">Disponível</div>
          </div>
        </div>
      )}

      {/* Barra legenda */}
      <div className="flex items-center gap-4 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-400 inline-block"/>Disponível</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-yellow-400 inline-block"/>Reservado p/ pedido</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-400 inline-block"/>Crítico</span>
      </div>

      {/* ── Filtros ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          className="input flex-1 min-w-[140px]" placeholder="Buscar SKU..."
        />
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'critico', label: `⚠️ ${countByStatus('critico')}` },
            { key: 'baixo', label: `🔸 ${countByStatus('baixo')}` },
            { key: 'ok', label: `✅ ${countByStatus('ok')}` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterStatus === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={openCreate} className="btn-primary text-sm whitespace-nowrap">+ Novo SKU</button>
      </div>

      {/* ── Cards de SKU ─────────────────────────────────── */}
      <div className="space-y-2">
        {filtered.map(s => {
          const statusColor = s.stock_status === 'critico'
            ? 'border-red-200 bg-red-50'
            : s.stock_status === 'baixo'
              ? 'border-yellow-200 bg-yellow-50'
              : 'border-slate-200 bg-white'

          return (
            <div key={s.id} className={`card border ${statusColor} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {s.stock_status === 'critico' && <span className="text-red-500 text-sm">⚠️</span>}
                    {s.stock_status === 'baixo' && <span className="text-yellow-500 text-sm">🔸</span>}
                    <span className="font-bold text-slate-800 truncate">{s.name}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {s.code} · {s.category} · {s.type} · {s.unit}
                  </div>

                  {/* Barra visual */}
                  <StockBar
                    physical={s.physical || 0}
                    reserved={s.reserved || 0}
                    available={s.available || 0}
                    minStock={s.min_stock || 0}
                  />

                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>Físico: <strong className="text-slate-700">{s.physical || 0}</strong></span>
                    <span>Mín: <strong className="text-slate-700">{s.min_stock}</strong></span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => openMov(s)}
                    className="text-xs font-semibold text-brand-500 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg whitespace-nowrap"
                  >
                    Movimentar
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg"
                  >
                    Editar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400">Nenhum produto encontrado</div>
        )}
      </div>

      {/* ── Modal SKU ─────────────────────────────────────── */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar SKU' : 'Novo SKU'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Código *</label><input value={form.code||''} onChange={e => F('code', e.target.value)} className="input" /></div>
            <div><label className="label">Unidade</label><input value={form.unit||''} onChange={e => F('unit', e.target.value)} className="input" placeholder="RL, UN, KG..." /></div>
          </div>
          <div><label className="label">Nome *</label><input value={form.name||''} onChange={e => F('name', e.target.value)} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Categoria</label><input value={form.category||''} onChange={e => F('category', e.target.value)} className="input" placeholder="Filme, Fita..." /></div>
            <div>
              <label className="label">Tipo</label>
              <select value={form.type||''} onChange={e => F('type', e.target.value)} className="input">
                <option value="">Selecione...</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Peso (kg)</label><input type="number" value={form.weight||''} onChange={e => F('weight', e.target.value)} className="input" step="0.01" /></div>
            <div><label className="label">Estoque Mínimo</label><input type="number" value={form.min_stock||''} onChange={e => F('min_stock', e.target.value)} className="input" /></div>
          </div>
          <div><label className="label">Observações</label><textarea value={form.observations||''} onChange={e => F('observations', e.target.value)} className="input" rows={2} /></div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSaveSku} disabled={loading} className="btn-primary flex-1">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Movimentação ────────────────────────────── */}
      <Modal open={movModal} onClose={() => setMovModal(false)} title={`Movimentar — ${movSku?.name}`}>
        {movSku && (
          <div className="space-y-4">
            {/* Saldos atuais */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Físico</div>
                  <div className="font-black text-slate-700">{movSku.physical || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Reservado</div>
                  <div className="font-black text-yellow-600">{movSku.reserved || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Disponível</div>
                  <div className={`font-black ${(movSku.available || 0) <= movSku.min_stock ? 'text-red-600' : 'text-green-600'}`}>
                    {movSku.available || 0}
                  </div>
                </div>
              </div>

              <StockBar
                physical={movSku.physical || 0}
                reserved={movSku.reserved || 0}
                available={movSku.available || 0}
                minStock={movSku.min_stock || 0}
              />
            </div>

            {/* Reservas por pedido */}
            {reservations.length > 0 && (
              <div>
                <button
                  onClick={() => setShowReservations(!showReservations)}
                  className="text-xs text-brand-500 font-semibold"
                >
                  {showReservations ? '▲ Ocultar' : '▼ Ver'} reservas por pedido ({reservations.length})
                </button>
                {showReservations && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                    {reservations.map((r, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-600 bg-yellow-50 rounded-lg px-3 py-2">
                        <span>Pedido #{r.order_id} — {r.client_name}</span>
                        <span className="font-bold">{r.quantity} {movSku.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="label">Tipo de movimentação</label>
              <select value={mov.type} onChange={e => setMov(p => ({...p, type: e.target.value}))} className="input">
                {MOV_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Quantidade</label>
              <input
                type="number" value={mov.quantity}
                onChange={e => setMov(p => ({...p, quantity: e.target.value}))}
                className="input text-lg font-bold" min="1"
                placeholder={mov.type === 'ajuste' ? 'Novo saldo total' : 'Quantidade'}
              />
            </div>
            <div>
              <label className="label">Motivo / Observação</label>
              <input value={mov.reason} onChange={e => setMov(p => ({...p, reason: e.target.value}))} className="input" placeholder="Opcional" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMovModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleMov} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
