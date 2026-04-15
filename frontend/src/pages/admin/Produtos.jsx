import { useState, useEffect } from 'react'
import api from '../../api'
import Modal from '../../components/Modal'

const fmt = v => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const EMPTY = { nome: '', tipo: 'STRETCH', gramatura: '', metragem: '', largura: '', descricao: '', preco_unitario: '', unidade: 'ROLO' }

export default function Produtos() {
  const [products, setProducts] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    const r = await api.get('/products')
    setProducts(r.data)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditing(null); setModal(true) }
  const openEdit = p => { setForm({ nome: p.nome, tipo: p.tipo, gramatura: p.gramatura||'', metragem: p.metragem||'', largura: p.largura||'', descricao: p.descricao||'', preco_unitario: p.preco_unitario||'', unidade: p.unidade }); setEditing(p.id); setModal(true) }

  const save = async () => {
    if (!form.nome) { alert('Nome obrigatório'); return }
    setSaving(true)
    try {
      if (editing) await api.put(`/products/${editing}`, form)
      else await api.post('/products', form)
      setModal(false)
      await load()
    } catch (e) { alert(e.response?.data?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const del = async (id, nome) => {
    if (!confirm(`Desativar produto "${nome}"?`)) return
    try { await api.delete(`/products/${id}`); await load() }
    catch (e) { alert(e.response?.data?.message || 'Erro') }
  }

  const filtered = products.filter(p =>
    !search || p.nome?.toLowerCase().includes(search.toLowerCase()) || p.tipo?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800">Produtos</h1>
        <button onClick={openNew} className="btn-primary">+ Novo</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} className="input" placeholder="Buscar produto..." />

      <div className="space-y-2">
        {filtered.map(p => (
          <div key={p.id} className="card p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-slate-800">{p.nome}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.tipo} · {p.unidade}
                  {p.gramatura ? ` · ${p.gramatura}g` : ''}
                  {p.metragem ? ` · ${p.metragem}m` : ''}
                  {p.largura ? ` · ${p.largura}mm` : ''}
                </div>
                {p.descricao && <div className="text-xs text-slate-400 mt-1">{p.descricao}</div>}
              </div>
              <div className="text-right">
                <div className="font-black text-brand-600">{fmt(p.preco_unitario)}</div>
                <div className="text-xs text-slate-400">/{p.unidade}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => openEdit(p)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50">Editar</button>
              <button onClick={() => del(p.id, p.nome)} className="py-2 px-3 rounded-lg border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50">Remover</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-slate-400 py-8">Nenhum produto encontrado</div>}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-3">
          <div>
            <label className="label">Nome *</label>
            <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))} className="input">
                <option value="STRETCH">STRETCH</option>
                <option value="FITA">FITA</option>
              </select>
            </div>
            <div>
              <label className="label">Unidade</label>
              <select value={form.unidade} onChange={e => setForm(f => ({...f, unidade: e.target.value}))} className="input">
                <option value="ROLO">ROLO</option>
                <option value="KG">KG</option>
                <option value="CAIXA">CAIXA</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">Gramatura (g)</label>
              <input type="number" value={form.gramatura} onChange={e => setForm(f => ({...f, gramatura: e.target.value}))} className="input" />
            </div>
            <div>
              <label className="label">Metragem (m)</label>
              <input type="number" value={form.metragem} onChange={e => setForm(f => ({...f, metragem: e.target.value}))} className="input" />
            </div>
            <div>
              <label className="label">Largura (mm)</label>
              <input type="number" value={form.largura} onChange={e => setForm(f => ({...f, largura: e.target.value}))} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Preço Unitário (R$)</label>
            <input type="number" step="0.01" value={form.preco_unitario} onChange={e => setForm(f => ({...f, preco_unitario: e.target.value}))} className="input" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea value={form.descricao} onChange={e => setForm(f => ({...f, descricao: e.target.value}))} className="input" rows={2} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
