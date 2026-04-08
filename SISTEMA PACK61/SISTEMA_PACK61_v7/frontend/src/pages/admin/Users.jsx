import { useState, useEffect } from 'react'
import api from '../../api'
import Modal from '../../components/Modal'

const ROLES = { admin: 'Administrador', vendedor: 'Vendedor', motorista: 'Motorista', producao: 'Produção' }

const EMPTY = { name: '', email: '', password: '', role: 'vendedor', active: 1 }

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.get('/users').then(r => setUsers(r.data))
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true) }
  const openEdit = (u) => { setForm({ ...u, password: '' }); setEditing(u.id); setError(''); setModal(true) }

  const handleSave = async () => {
    setError(''); setLoading(true)
    try {
      if (editing) await api.put(`/users/${editing}`, form)
      else await api.post('/users', form)
      await load(); setModal(false)
    } catch (e) { setError(e.response?.data?.error || 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  const handleToggle = async (u) => {
    await api.put(`/users/${u.id}`, { ...u, active: u.active ? 0 : 1 })
    load()
  }

  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">{users.length} usuário(s) cadastrado(s)</p>
        <button onClick={openCreate} className="btn-primary text-sm">+ Novo Usuário</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">E-mail</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Perfil</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3"><span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-full">{ROLES[u.role]}</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(u)} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(u)} className="text-brand-500 hover:text-brand-700 text-xs font-semibold">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Usuário' : 'Novo Usuário'}>
        <div className="space-y-4">
          {[['Nome completo', 'name', 'text'], ['E-mail', 'email', 'email']].map(([label, key, type]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input type={type} value={form[key] || ''} onChange={e => F(key, e.target.value)} className="input" />
            </div>
          ))}
          <div>
            <label className="label">{editing ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</label>
            <input type="password" value={form.password || ''} onChange={e => F('password', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Perfil</label>
            <select value={form.role} onChange={e => F('role', e.target.value)} className="input">
              {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
