export default function KPICard({ label, value, sub, color = 'brand', icon }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  }

  return (
    <div className={`card p-4 border-l-4 ${colors[color] || colors.brand}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 truncate">{label}</p>
          <p className="text-2xl font-black text-slate-800 leading-none">{value ?? '-'}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && <span className="text-2xl opacity-60 flex-shrink-0">{icon}</span>}
      </div>
    </div>
  )
}
