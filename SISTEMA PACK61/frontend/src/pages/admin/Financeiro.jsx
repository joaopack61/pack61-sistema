import { useState, useEffect } from 'react'
import api from '../../api'

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—'

export default function Financeiro() {
  const [tab, setTab] = useState('payments')
  const [payments, setPayments] = useState([])
  const [tubes, setTubes] = useState([])
  const [overdue, setOverdue] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const loadPayments = async () => {
    setLoading(true)
    try {
      const [p, t, o] = await Promise.all([
        api.get('/financial/payments'),
        api.get('/financial/tubes'),
        api.get('/financial/overdue'),
      ])
      setPayments(p.data)
      setTubes(t.data)
      setOverdue(o.data.payments || [])
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadPayments() }, [])

  const markPaymentPaid = async (id) => {
    if (!confirm('Confirmar pagamento?')) return
    try {
      await api.put(`/financial/payments/${id}/pay`, { forma_pagamento: 'PIX' })
      await loadPayments()
    } catch (e) { alert(e.response?.data?.message || 'Erro') }
  }

  const markTubePaid = async (id) => {
    if (!confirm('Marcar tubo como pago?')) return
    try {
      await api.put(`/financial/tubes/${id}/pay`)
      await loadPayments()
    } catch (e) { alert(e.response?.data?.message || 'Erro') }
  }

  const filteredPayments = payments.filter(p =>
    !filter || p.client_name?.toLowerCase().includes(filter.toLowerCase()) || p.razao_social?.toLowerCase().includes(filter.toLowerCase())
  )

  const totalPendente = payments.filter(p => p.status === 'PENDENTE').reduce((s, p) => s + parseFloat(p.valor || 0), 0)
  const totalAtrasado = overdue.reduce((s, p) => s + parseFloat(p.valor || 0), 0)
  const totalTubosPendentes = tubes.filter(t => t.status_pagamento === 'PENDENTE').reduce((s, t) => s + parseFloat(t.valor_total || 0), 0)

  const TABS = [
    { key: 'payments', label: 'Pagamentos' },
    { key: 'tubes',    label: 'Tubos' },
    { key: 'overdue',  label: `Inadimplência ${overdue.length > 0 ? `(${overdue.length})` : ''}` },
  ]

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800">Financeiro</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-4 bg-yellow-50">
          <div className="text-xs font-semibold text-yellow-700 uppercase mb-1">Pendente</div>
          <div className="text-lg font-black text-yellow-800">{fmt(totalPendente)}</div>
        </div>
        <div className="card p-4 bg-red-50">
          <div className="text-xs font-semibold text-red-700 uppercase mb-1">Atrasado</div>
          <div className="text-lg font-black text-red-800">{fmt(totalAtrasado)}</div>
        </div>
        <div className="card p-4 bg-blue-50">
          <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Tubos Pend.</div>
          <div className="text-lg font-black text-blue-800">{fmt(totalTubosPendentes)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${tab === t.key ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtro */}
      {tab !== 'overdue' && (
        <input value={filter} onChange={e => setFilter(e.target.value)}
          className="input" placeholder="Filtrar por cliente..." />
      )}

      {loading && <div className="text-center text-slate-400 py-8">Carregando...</div>}

      {/* Pagamentos */}
      {tab === 'payments' && !loading && (
        <div className="space-y-2">
          {filteredPayments.length === 0 && <div className="text-center text-slate-400 py-8">Nenhum pagamento</div>}
          {filteredPayments.map(p => (
            <div key={p.id} className={`card p-4 border-l-4 ${p.status === 'PAGO' ? 'border-green-400' : p.status === 'ATRASADO' ? 'border-red-400' : 'border-yellow-400'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-800 text-sm">{p.client_name || p.razao_social}</div>
                  <div className="text-xs text-slate-500">Pedido #{p.order_id} · Vence: {fmtDate(p.data_vencimento)}</div>
                  {p.data_pagamento && <div className="text-xs text-green-600">Pago em: {fmtDate(p.data_pagamento)}</div>}
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-800">{fmt(p.valor)}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.status === 'PAGO' ? 'bg-green-100 text-green-700' : p.status === 'ATRASADO' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {p.status}
                  </span>
                </div>
              </div>
              {p.status !== 'PAGO' && (
                <button onClick={() => markPaymentPaid(p.id)}
                  className="mt-2 w-full py-2 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors">
                  ✅ Registrar Pagamento
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tubos */}
      {tab === 'tubes' && !loading && (
        <div className="space-y-2">
          {tubes.filter(t => !filter || (t.client_name||'').toLowerCase().includes(filter.toLowerCase())).map(t => (
            <div key={t.id} className={`card p-4 border-l-4 ${t.status_pagamento === 'PAGO' ? 'border-green-400' : 'border-blue-400'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-800 text-sm">{t.client_name || t.razao_social}</div>
                  <div className="text-xs text-slate-500">Motorista: {t.driver_name} · Pedido #{t.order_id}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    P5: {t.quantidade_p5} un → {fmt(t.valor_p5)} &nbsp;|&nbsp; P10: {t.quantidade_p10} un → {fmt(t.valor_p10)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-800">{fmt(t.valor_total)}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.status_pagamento === 'PAGO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {t.status_pagamento}
                  </span>
                </div>
              </div>
              {t.status_pagamento !== 'PAGO' && (
                <button onClick={() => markTubePaid(t.id)}
                  className="mt-2 w-full py-2 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors">
                  💰 Marcar como Pago
                </button>
              )}
            </div>
          ))}
          {tubes.length === 0 && <div className="text-center text-slate-400 py-8">Nenhum registro de tubos</div>}
        </div>
      )}

      {/* Inadimplência */}
      {tab === 'overdue' && !loading && (
        <div className="space-y-2">
          {overdue.length === 0 && <div className="text-center text-slate-400 py-8">Sem pagamentos atrasados 🎉</div>}
          {overdue.map(p => (
            <div key={p.id} className="card p-4 border-l-4 border-red-500">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-800 text-sm">{p.client_name}</div>
                  {p.contato_telefone && <a href={`tel:${p.contato_telefone}`} className="text-xs text-blue-600">📞 {p.contato_telefone}</a>}
                  <div className="text-xs text-red-600 mt-1">Venceu em: {fmtDate(p.data_vencimento)}</div>
                </div>
                <div className="font-black text-red-700">{fmt(p.valor)}</div>
              </div>
              <button onClick={() => markPaymentPaid(p.id)}
                className="mt-2 w-full py-2 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors">
                ✅ Registrar Pagamento
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
