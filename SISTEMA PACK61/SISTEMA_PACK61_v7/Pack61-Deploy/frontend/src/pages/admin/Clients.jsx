import { useState, useEffect } from 'react'
import api from '../../api'
import Modal from '../../components/Modal'

const EMPTY = { name: '', company_name: '', cnpj: '', address: '', city: '', region: '', state: '', phone: '', whatsapp: '', email: '', segment: '', responsible: '', notes: '', seller_id: '' }

function waLink(number) {
  if (!number) return null
  const clean = number.replace(/\D/g, '')
  return `https://wa.me/55${clean}`
}

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sellers, setSellers] = useState([])

  const load = (s = '') => api.get('/clients', { params: { search: s } }).then(r => setClients(r.data))
  useEffect(() => {
    load()
    api.get('/users').then(r => setSellers(r.data.filter(u => u.role === 'vendedor')))
  }, [])
  useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t) }, [search])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true) }
  const openEdit = (c) => { setForm({ ...EMPTY, ...c }); setEditing(c.id); setModal(true) }

  const handleSave = async () => {
    if (!form.name?.trim()) return alert('Nome obrigatório')
    setLoading(true)
    try {
      if (editing) await api.put(`/clients/${editing}`, form)
      else await api.post('/clients', form)
      await load(search); setModal(false)
    } catch (e) { alert(e.response?.data?.error || 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Desativar este cliente?')) return
    await api.delete(`/clients/${id}`)
    load(search)
  }

  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          className="input flex-1" placeholder="Buscar por nome, cidade, telefone..."
        />
        <button onClick={openCreate} className="btn-primary text-sm whitespace-nowrap">+ Novo</button>
      </div>

      <p className="text-xs text-slate-400">{clients.length} cliente(s)</p>

      {/* Cards responsivos no mobile, tabela no desktop */}
      <div className="hidden lg:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Cidade</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Segmento</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Contato</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Vendedor</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{c.name}</div>
                    {c.company_name && c.company_name !== c.name && <div className="text-xs text-slate-400">{c.company_name}</div>}
                    {c.responsible && <div className="text-xs text-slate-400">{c.responsible}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.city}</td>
                  <td className="px-4 py-3 text-slate-500">{c.segment}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-slate-600">📞 {c.phone}</a>}
                      {(c.whatsapp || c.phone) && (
                        <a href={waLink(c.whatsapp || c.phone)} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-green-600 font-semibold">💬 WhatsApp</a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{c.seller_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => openEdit(c)} className="text-brand-500 hover:text-brand-700 text-xs font-semibold">Editar</button>
                      <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 text-xs font-semibold">Desativar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.length === 0 && <div className="text-center py-10 text-slate-400">Nenhum cliente encontrado</div>}
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="lg:hidden space-y-2">
        {clients.map(c => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 truncate">{c.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {[c.city, c.segment, c.seller_name].filter(Boolean).join(' · ')}
                </div>
                {c.responsible && <div className="text-xs text-slate-400 mt-0.5">{c.responsible}</div>}
              </div>
              <button onClick={() => openEdit(c)} className="text-brand-500 text-xs font-semibold flex-shrink-0">Editar</button>
            </div>
            {(c.phone || c.whatsapp) && (
              <div className="flex gap-2">
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex-1 text-center text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg py-2">
                    📞 Ligar
                  </a>
                )}
                {(c.whatsapp || c.phone) && (
                  <a href={waLink(c.whatsapp || c.phone)} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg py-2">
                    💬 WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
        {clients.length === 0 && <div className="text-center py-10 text-slate-400">Nenhum cliente</div>}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Cliente' : 'Novo Cliente'}>
        <div className="space-y-3">
          <div>
            <label className="label">Nome / Razão Social *</label>
            <input value={form.name || ''} onChange={e => F('name', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Nome Fantasia</label>
            <input value={form.company_name || ''} onChange={e => F('company_name', e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">CNPJ</label>
              <input value={form.cnpj || ''} onChange={e => F('cnpj', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Responsável</label>
              <input value={form.responsible || ''} onChange={e => F('responsible', e.target.value)} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Telefone</label>
              <input type="tel" value={form.phone || ''} onChange={e => F('phone', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input type="tel" value={form.whatsapp || ''} onChange={e => F('whatsapp', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" value={form.email || ''} onChange={e => F('email', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Endereço</label>
            <input value={form.address || ''} onChange={e => F('address', e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cidade</label>
              <input value={form.city || ''} onChange={e => F('city', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Segmento</label>
              <input value={form.segment || ''} onChange={e => F('segment', e.target.value)} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Região</label>
              <input value={form.region || ''} onChange={e => F('region', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Estado</label>
              <input value={form.state || ''} onChange={e => F('state', e.target.value)} className="input" maxLength={2} placeholder="SP" />
            </div>
          </div>
          {sellers.length > 0 && (
            <div>
              <label className="label">Vendedor Responsável</label>
              <select value={form.seller_id || ''} onChange={e => F('seller_id', e.target.value)} className="input">
                <option value="">Selecione...</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Observações</label>
            <textarea value={form.notes || ''} onChange={e => F('notes', e.target.value)} className="input" rows={2} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
