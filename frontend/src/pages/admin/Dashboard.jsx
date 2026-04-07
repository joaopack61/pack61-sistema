import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import api from '../../api'
import KPICard from '../../components/KPICard'
import StatusBadge from '../../components/StatusBadge'

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#f59e0b']

const STATUS_PIPELINE = [
  { key: 'pendente', label: 'Pendentes', color: 'bg-yellow-400', link: '/admin/pedidos' },
  { key: 'em_producao', label: 'Em Produção', color: 'bg-blue-400', link: '/admin/pedidos' },
  { key: 'pronto_expedicao', label: 'P/ Expedição', color: 'bg-purple-400', link: '/admin/logistica' },
  { key: 'entregue', label: 'Entregues', color: 'bg-green-400', link: '/admin/logistica' },
]

function fmt(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtR(value) {
  return `R$ ${fmt(value)}`
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pipeline, setPipeline] = useState([])

  useEffect(() => {
    Promise.all([
      api.get('/dashboard'),
      api.get('/orders'),
    ]).then(([dash, orders]) => {
      setData(dash.data)
      const counts = {}
      orders.data.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1 })
      setPipeline(STATUS_PIPELINE.map(s => ({ ...s, count: counts[s.key] || 0 })))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent"/>
    </div>
  )
  if (!data) return null

  const revenueChartData = (data.revenue_by_day || []).map(d => ({
    day: d.day?.slice(5), // MM-DD
    total: Number(d.total),
  }))

  const totalOrdersMonth = pipeline.reduce((a, s) => a + s.count, 0)
  const conversionRate = data.visits_week > 0
    ? Math.round(((data.orders_month || 0) / Math.max(1, data.visits_month)) * 100)
    : 0

  return (
    <div className="space-y-5">

      {/* ── KPIs Financeiros ─────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Financeiro — Este Mês</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Faturado (entregas)</div>
            <div className="text-xl font-black text-green-600 leading-tight">{fmtR(data.revenue_month)}</div>
            <div className="text-xs text-slate-400 mt-1">{data.orders_delivered} pedido(s) entregue(s)</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">A Receber</div>
            <div className="text-xl font-black text-orange-500 leading-tight">{fmtR(data.revenue_pending)}</div>
            <div className="text-xs text-slate-400 mt-1">Pedidos em aberto</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Ticket Médio</div>
            <div className="text-xl font-black text-blue-600 leading-tight">{fmtR(data.ticket_medio)}</div>
            <div className="text-xs text-slate-400 mt-1">{data.orders_month || 0} pedido(s) no mês</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Conversão</div>
            <div className="text-xl font-black text-purple-600 leading-tight">{conversionRate}%</div>
            <div className="text-xs text-slate-400 mt-1">Visitas → Pedidos</div>
          </div>
        </div>
      </div>

      {/* ── Pipeline de Pedidos ──────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pipeline de Pedidos</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {pipeline.map(s => (
            <Link key={s.key} to={s.link} className="card p-4 hover:shadow-md transition-shadow">
              <div className={`w-2 h-2 rounded-full ${s.color} mb-2`} />
              <div className="text-2xl font-black text-slate-800">{s.count}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">{s.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Alertas ──────────────────────────────────────────────── */}
      {data.low_stock > 0 && (
        <Link to="/admin/estoque" className="block">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-red-500 text-xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-700">{data.low_stock} produto(s) com estoque crítico</p>
              <p className="text-xs text-red-500">Ver módulo de estoque</p>
            </div>
          </div>
        </Link>
      )}

      {/* ── KPIs Operacionais ────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Operação — Este Mês</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <KPICard label="Visitas" value={data.visits_month} icon="👁️" color="brand" />
          <KPICard label="Clientes" value={data.total_clients} icon="🏢" color="blue" />
          <KPICard label="Canhotos OK" value={data.deliveries_with_canhoto} icon="📄" color="green" />
          <KPICard label="Sem Canhoto" value={data.deliveries_without_canhoto} icon="⚠️" color="slate" />
        </div>
      </div>

      {/* ── KPIs de Tubos ────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tubos</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Recolhidos (mês)</div>
            <div className="text-2xl font-black text-blue-600">{fmt(data.tubes_month)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Recolhidos (semana)</div>
            <div className="text-2xl font-black text-blue-500">{fmt(data.tubes_week)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Pendências abertas</div>
            <div className={`text-2xl font-black ${data.tubes_pending_open > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(data.tubes_pending_open)}</div>
          </div>
        </div>
        {data.tubes_pending_open > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 mt-2">
            <span className="text-red-500 text-xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-700">{data.tubes_pending_open} entrega(s) com tubo pendente</p>
              <p className="text-xs text-red-500">Ver módulo de logística → Tubos</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Gráfico de faturamento por dia ───────────────────────── */}
      {revenueChartData.length > 1 && (
        <div className="card p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-3">Faturamento diário (mês atual)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={revenueChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={v => [fmtR(v), 'Faturamento']}
              />
              <Area type="monotone" dataKey="total" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Gráficos Vendedores e Status ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.visits_by_seller?.length > 0 && (
          <div className="card p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-3">Visitas por Vendedor (mês)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.visits_by_seller} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.order_status_chart?.length > 0 && (
          <div className="card p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-3">Status dos Pedidos</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={data.order_status_chart} dataKey="count" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                    {data.order_status_chart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {data.order_status_chart.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-600 truncate flex-1">{s.status}</span>
                    <span className="font-bold text-slate-800">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Top Vendedores ───────────────────────────────────────── */}
      {data.top_sellers?.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-3">Top Vendedores — Mês Atual</h3>
          <div className="space-y-3">
            {data.top_sellers.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-700' : 'bg-orange-200 text-orange-800'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{s.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[120px]">
                      <div
                        className="bg-brand-400 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (s.total_orders / (data.top_sellers[0]?.total_orders || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">{s.total_orders} pedido(s)</span>
                  </div>
                </div>
                <div className="text-sm font-bold text-brand-600 flex-shrink-0">
                  {fmtR(s.total_value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Motivos de Perda ─────────────────────────────────────── */}
      {data.loss_reasons?.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-3">Motivos de Perda — Mês Atual</h3>
          <div className="space-y-2">
            {data.loss_reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-red-500 w-7 flex-shrink-0">{r.count}x</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 truncate">{r.no_order_reason || 'Não informado'}</div>
                  <div className="bg-slate-100 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-red-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (r.count / (data.loss_reasons[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
