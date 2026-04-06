import { useState, useEffect } from 'react'
import api from '../../api'
import Modal from '../../components/Modal'

const EMPTY = { name: '', company_name: '', phone: '', whatsapp: '', address: '', city: '', region: '', segment: '', responsible: '', notes: '' }

function waLink(number) {
  if (!number) return null
  const clean = number.replace(/\D/g, '')
  return `https://wa.me/55${clean}`
}

function phoneLink(number) {
  if (!number) return null
  return `tel:${number.replace(/\D/g, '')}`
}

export default function VendedorClientes() {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = (s = '') => api.get('/clients', { params: { search: s } }).then(r => setClients(r.data))
  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t) }, [search])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true) }
  const openEdit = (c) => {
    setForm({ ...EMPTY, ...c })
    setEditing(c.id); setModal(true)
  }
  const handleSave = async () => {
    if (!form.name?.trim()) return alert('Nome obrigatório')
    setLoading(true)
    try {
      if (editing) await api.put(`/clients/${editing}`, form)
      else await api.post('/clients', form)
      await load(search); setModal(false)
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao salvar')
    } finally { setLoading(false) }
  }
  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          className="input flex-1" placeholder="Buscar por nome, cidade, telefone..."
        />
        <button onClick={openCreate} className="btn-primary text-sm whitespace-nowrap">+ Novo</button>
      </div>

      <p className="text-xs text-slate-400">{clients.length} cliente(s)</p>

      <div className="space-y-2">
        {clients.map(c => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <div className="font-bold text-slate-800 truncate">{c.name}</div>
                {c.company_name && c.company_name !== c.name && (
                  <div className="text-xs text-slate-400 truncate">{c.company_name}</div>
                )}
                <div className="text-xs text-slate-500 mt-0.5">
                  {[c.city, c.segment].filter(Boolean).join(' · ')}
                </div>
              </button>
              <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-brand-500 text-xs font-semibold flex-shrink-0 px-2 py-1">
                Editar
              </button>
            </div>

            {/* Contatos rápidos — sempre visíveis */}
            {(c.phone || c.whatsapp) && (
              <div className="flex gap-2 mt-3">
                {c.phone && (
                  <a
                    href={phoneLink(c.phone)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg px-3 py-2 flex-1 justify-center"
                  >
                    📞 Ligar
                  </a>
                )}
                {(c.whatsapp || c.phone) && (
                  <a
                    href={waLink(c.whatsapp || c.phone)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex-1 justify-center"
                  >
                    <span>💬</span> WhatsApp
                  </a>
                )}
              </div>
            )}

            {/* Detalhes expandidos */}
            {expanded === c.id && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                {c.responsible && <div><span className="text-slate-400">Responsável:</span> {c.responsible}</div>}
                {c.address && <div><span className="text-slate-400">Endereço:</span> {c.address}</div>}
                {c.region && <div><span className="text-slate-400">Região:</span> {c.region}</div>}
                {c.notes && <div className="mt-1 text-slate-500 italic">"{c.notes}"</div>}
                <div className="text-slate-400 mt-1">Cadastrado por: {c.seller_name}</div>
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
            <input value={form.name || ''} onChange={e => F('name', e.target.value)} className="input" placeholder="Nome do cliente ou empresa" />
          </div>
          <div>
            <label className="label">Nome Fantasia</label>
            <input value={form.company_name || ''} onChange={e => F('company_name', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Responsável pela compra</label>
            <input value={form.responsible || ''} onChange={e => F('responsible', e.target.value)} className="input" placeholder="Nome do contato" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Telefone</label>
              <input type="tel" value={form.phone || ''} onChange={e => F('phone', e.target.value)} className="input" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input type="tel" value={form.whatsapp || ''} onChange={e => F('whatsapp', e.target.value)} className="input" placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cidade</label>
              <input value={form.city || ''} onChange={e => F('city', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Segmento</label>
              <input value={form.segment || ''} onChange={e => F('segment', e.target.value)} className="input" placeholder="Ex: Supermercado" />
            </div>
          </div>

          <div>
            <label className="label">Endereço</label>
            <input value={form.address || ''} onChange={e => F('address', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Região / Bairro</label>
            <input value={form.region || ''} onChange={e => F('region', e.target.value)} className="input" />
          </div>
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
