import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'

const today = new Date().toISOString().split('T')[0]

const LOSS_REASONS = [
  'Preço alto',
  'Usando concorrente',
  'Sem necessidade no momento',
  'Falta de verba / orçamento',
  'Negociando com outro fornecedor',
  'Cliente em reformulação interna',
  'Não tinha responsável presente',
  'Problema de qualidade anterior',
  'Prazo de entrega longo',
  'Outro',
]

const PAYMENT_TERMS = [
  'À vista',
  '7 dias',
  '14 dias',
  '21 dias',
  '28 dias',
  '30/60 dias',
  '30/60/90 dias',
  'Boleto 30 dias',
]

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-1 justify-center mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i <= current - 1 ? 'bg-brand-500 w-8' : 'bg-slate-200 w-4'}`}
        />
      ))}
    </div>
  )
}

export default function NovaVisita() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [skus, setSkus] = useState([])
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientSearch, setClientSearch] = useState('')

  const [form, setForm] = useState({
    // Cliente
    client_id: '',
    newClient: false,
    client_name: '',
    client_phone: '',
    client_whatsapp: '',
    client_address: '',
    client_city: '',
    client_region: '',
    client_segment: '',
    client_responsible: '',
    // Visita
    visit_date: today,
    took_order: null,
    no_order_reason: '',
    // Informações comerciais
    next_purchase_date: '',
    competitor: '',
    competitor_price: '',
    bobine_type: 'manual',
    tube_type: 'com_tubo',
    monthly_volume: '',
    products_interest: '',
    observations: '',
    photo: null,
    // Pedido
    payment_terms: '',
    delivery_date: '',
  })

  const [orderItems, setOrderItems] = useState([{ sku_id: '', quantity: '', unit_price: '' }])

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data))
    api.get('/stock/skus').then(r => setSkus(r.data))
  }, [])

  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const filteredClients = clients.filter(c =>
    !clientSearch ||
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.city?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone?.includes(clientSearch)
  )

  const addItem = () => setOrderItems(p => [...p, { sku_id: '', quantity: '', unit_price: '' }])
  const removeItem = (i) => setOrderItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i, k, v) => setOrderItems(p => p.map((item, idx) => idx === i ? { ...item, [k]: v } : item))

  const orderTotal = orderItems.reduce((acc, i) => acc + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)), 0)

  const selectedClient = clients.find(c => String(c.id) === String(form.client_id))

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      let clientId = form.client_id

      if (form.newClient) {
        if (!form.client_name.trim()) {
          setError('Nome do cliente obrigatório')
          setLoading(false)
          return
        }
        const r = await api.post('/clients', {
          name: form.client_name,
          phone: form.client_phone,
          whatsapp: form.client_whatsapp,
          address: form.client_address,
          city: form.client_city,
          region: form.client_region,
          segment: form.client_segment,
          responsible: form.client_responsible,
        })
        clientId = r.data.id
      }

      if (!clientId) {
        setError('Selecione ou cadastre um cliente')
        setLoading(false)
        return
      }

      if (form.took_order === null) {
        setError('Informe se tirou pedido ou não')
        setLoading(false)
        return
      }

      const visitData = new FormData()
      const fields = {
        client_id: clientId,
        visit_date: form.visit_date,
        took_order: form.took_order ? 1 : 0,
        no_order_reason: form.no_order_reason,
        next_purchase_date: form.next_purchase_date,
        competitor: form.competitor,
        competitor_price: form.competitor_price,
        bobine_type: form.bobine_type,
        tube_type: form.tube_type,
        monthly_volume: form.monthly_volume,
        products_interest: form.products_interest,
        observations: form.observations,
      }
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) visitData.append(k, v)
      })
      if (form.photo) visitData.append('photo', form.photo)

      const vr = await api.post('/visits', visitData, { headers: { 'Content-Type': 'multipart/form-data' } })

      if (form.took_order) {
        const validItems = orderItems.filter(i => i.sku_id && i.quantity)
        if (!validItems.length) {
          setError('Adicione pelo menos um produto ao pedido')
          setLoading(false)
          return
        }
        await api.post('/orders', {
          client_id: clientId,
          visit_id: vr.data.id,
          payment_terms: form.payment_terms,
          delivery_date: form.delivery_date,
          items: validItems.map(i => ({
            sku_id: parseInt(i.sku_id),
            quantity: parseInt(i.quantity),
            unit_price: parseFloat(i.unit_price) || 0,
          })),
          notes: form.observations,
        })
      }

      navigate('/vendedor', { replace: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao registrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const canGoToStep2 = form.newClient ? form.client_name.trim().length > 0 : !!form.client_id
  const canGoToStep3 = form.took_order !== null
  const canSubmit = form.took_order !== null && (form.took_order ? orderItems.some(i => i.sku_id && i.quantity) : true)
  const totalSteps = form.took_order === true ? 3 : 2

  return (
    <div className="max-w-lg mx-auto pb-24">
      <StepIndicator current={step} total={totalSteps} />

      {/* ── PASSO 1: CLIENTE ──────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-black text-slate-800 text-base mb-4">Qual cliente você visitou?</h2>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { F('newClient', false); F('client_id', '') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${!form.newClient ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                Já cadastrado
              </button>
              <button
                onClick={() => { F('newClient', true); F('client_id', '') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${form.newClient ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                Novo cliente
              </button>
            </div>

            {!form.newClient ? (
              <div className="space-y-3">
                <input
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="input"
                  placeholder="Buscar por nome, cidade ou telefone..."
                />
                <div className="max-h-52 overflow-y-auto space-y-1.5">
                  {filteredClients.slice(0, 25).map(c => (
                    <button
                      key={c.id}
                      onClick={() => F('client_id', String(c.id))}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors border-2 ${String(form.client_id) === String(c.id) ? 'bg-brand-50 border-brand-400 text-brand-800' : 'bg-slate-50 border-transparent text-slate-700 hover:bg-slate-100'}`}
                    >
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {[c.city, c.segment, c.responsible].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  ))}
                  {filteredClients.length === 0 && <p className="text-center py-4 text-slate-400 text-sm">Nenhum cliente encontrado</p>}
                </div>

                {/* Dados do cliente selecionado */}
                {selectedClient && (
                  <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                    {selectedClient.responsible && <div><span className="text-slate-400">Responsável:</span> {selectedClient.responsible}</div>}
                    {selectedClient.phone && <div><span className="text-slate-400">Tel:</span> {selectedClient.phone}</div>}
                    {selectedClient.address && <div><span className="text-slate-400">End:</span> {selectedClient.address}, {selectedClient.city}</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Nome / Empresa *</label>
                  <input value={form.client_name || ''} onChange={e => F('client_name', e.target.value)} className="input" placeholder="Razão social ou nome fantasia" />
                </div>
                <div>
                  <label className="label">Responsável pela compra</label>
                  <input value={form.client_responsible || ''} onChange={e => F('client_responsible', e.target.value)} className="input" placeholder="Nome do contato" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Telefone</label>
                    <input type="tel" value={form.client_phone || ''} onChange={e => F('client_phone', e.target.value)} className="input" placeholder="(11) 99999-9999" />
                  </div>
                  <div>
                    <label className="label">WhatsApp</label>
                    <input type="tel" value={form.client_whatsapp || ''} onChange={e => F('client_whatsapp', e.target.value)} className="input" placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Cidade</label>
                    <input value={form.client_city || ''} onChange={e => F('client_city', e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">Segmento</label>
                    <input value={form.client_segment || ''} onChange={e => F('client_segment', e.target.value)} className="input" placeholder="Ex: Supermercado" />
                  </div>
                </div>
                <div>
                  <label className="label">Endereço</label>
                  <input value={form.client_address || ''} onChange={e => F('client_address', e.target.value)} className="input" />
                </div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <label className="label">Data da Visita</label>
            <input type="date" value={form.visit_date} onChange={e => F('visit_date', e.target.value)} className="input" max={today} />
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!canGoToStep2}
            className="btn-primary w-full py-4 text-base disabled:opacity-40"
          >
            Próximo →
          </button>
        </div>
      )}

      {/* ── PASSO 2: RESULTADO ────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-black text-slate-800 text-base mb-4">Como foi a visita?</h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => F('took_order', true)}
                className={`py-5 rounded-2xl text-center font-black transition-all border-2 ${form.took_order === true ? 'bg-green-500 text-white border-green-500 scale-105 shadow-lg shadow-green-200' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                <div className="text-3xl mb-1">✅</div>
                <div className="text-sm">Tirou Pedido</div>
              </button>
              <button
                onClick={() => F('took_order', false)}
                className={`py-5 rounded-2xl text-center font-black transition-all border-2 ${form.took_order === false ? 'bg-red-500 text-white border-red-500 scale-105 shadow-lg shadow-red-200' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                <div className="text-3xl mb-1">❌</div>
                <div className="text-sm">Sem Pedido</div>
              </button>
            </div>

            {form.took_order === false && (
              <div>
                <label className="label mb-2">Motivo de não fechar *</label>
                <div className="space-y-1.5">
                  {LOSS_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => F('no_order_reason', r)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 ${form.no_order_reason === r ? 'bg-red-50 border-red-400 text-red-700' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Informações comerciais */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-700 text-sm">Informações Comerciais</h3>

            <div>
              <label className="label">Previsão próxima compra</label>
              <input type="date" value={form.next_purchase_date} onChange={e => F('next_purchase_date', e.target.value)} className="input" min={today} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo de Bobine</label>
                <select value={form.bobine_type} onChange={e => F('bobine_type', e.target.value)} className="input">
                  <option value="manual">Manual</option>
                  <option value="automatica">Automática</option>
                  <option value="ambas">Ambas</option>
                </select>
              </div>
              <div>
                <label className="label">Uso de Tubo</label>
                <select value={form.tube_type} onChange={e => F('tube_type', e.target.value)} className="input">
                  <option value="com_tubo">Com Tubo</option>
                  <option value="sem_tubo">Sem Tubo</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Volume mensal estimado (unidades)</label>
              <input type="number" value={form.monthly_volume} onChange={e => F('monthly_volume', e.target.value)} className="input" placeholder="Ex: 200" min="0" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Concorrente atual</label>
                <input value={form.competitor} onChange={e => F('competitor', e.target.value)} className="input" placeholder="Ex: FilmePro" />
              </div>
              <div>
                <label className="label">Preço concorrente (R$)</label>
                <input type="number" value={form.competitor_price} onChange={e => F('competitor_price', e.target.value)} className="input" step="0.01" placeholder="0,00" />
              </div>
            </div>

            <div>
              <label className="label">Produtos de interesse</label>
              <input value={form.products_interest} onChange={e => F('products_interest', e.target.value)} className="input" placeholder="Ex: Filme 25cm manual, Fita 48mm..." />
            </div>

            <div>
              <label className="label">Observações da visita</label>
              <textarea value={form.observations} onChange={e => F('observations', e.target.value)} className="input" rows={3} placeholder="Anotações importantes sobre o cliente ou a visita..." />
            </div>

            <div>
              <label className="label">Foto (local / cartão de visita) — opcional</label>
              <input type="file" accept="image/*" capture="environment" onChange={e => F('photo', e.target.files[0])} className="input text-sm" />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary px-6 py-4">← Voltar</button>
            {form.took_order === true ? (
              <button
                onClick={() => { setError(''); setStep(3) }}
                disabled={!canGoToStep3}
                className="btn-primary flex-1 py-4 text-base disabled:opacity-40"
              >
                Adicionar Produtos →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || form.took_order === null}
                className="btn-primary flex-1 py-4 text-base disabled:opacity-40"
              >
                {loading ? 'Salvando...' : '✓ Finalizar Visita'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PASSO 3: PEDIDO ───────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-black text-slate-800 text-base mb-4">Produtos do Pedido</h2>

            <div className="space-y-3">
              {orderItems.map((item, i) => {
                const sku = skus.find(s => String(s.id) === String(item.sku_id))
                return (
                  <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase">Produto {i + 1}</span>
                      {i > 0 && (
                        <button onClick={() => removeItem(i)} className="text-red-400 text-xs font-semibold">Remover</button>
                      )}
                    </div>
                    <div>
                      <label className="label">Produto (SKU)</label>
                      <select value={item.sku_id} onChange={e => updateItem(i, 'sku_id', e.target.value)} className="input">
                        <option value="">Selecione o produto...</option>
                        {skus.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name} {s.quantity_available != null ? `(Disp: ${s.quantity_available})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {sku && sku.quantity_available != null && sku.quantity_available <= (sku.min_stock || 0) && (
                      <div className="text-xs text-red-600 font-semibold bg-red-50 rounded-lg px-3 py-1.5">
                        ⚠️ Estoque baixo: apenas {sku.quantity_available} disponível
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label">Quantidade</label>
                        <input
                          type="number" value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', e.target.value)}
                          className="input text-lg font-bold" min="1" placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="label">Preço unit. (R$)</label>
                        <input
                          type="number" value={item.unit_price}
                          onChange={e => updateItem(i, 'unit_price', e.target.value)}
                          className="input" step="0.01" placeholder="0,00"
                        />
                      </div>
                    </div>
                    {item.quantity && item.unit_price && (
                      <div className="text-right text-sm font-bold text-brand-600">
                        Subtotal: R$ {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button onClick={addItem} className="btn-secondary w-full mt-3 py-3 text-sm">
              + Adicionar Produto
            </button>
          </div>

          {/* Condições do pedido */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-700 text-sm">Condições do Pedido</h3>
            <div>
              <label className="label">Prazo de Pagamento</label>
              <select value={form.payment_terms} onChange={e => F('payment_terms', e.target.value)} className="input">
                <option value="">Selecione...</option>
                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data de Entrega Prevista</label>
              <input
                type="date" value={form.delivery_date}
                onChange={e => F('delivery_date', e.target.value)}
                className="input" min={today}
              />
            </div>
          </div>

          {/* Total */}
          {orderTotal > 0 && (
            <div className="bg-brand-50 border-2 border-brand-200 rounded-2xl p-4 flex items-center justify-between">
              <span className="font-bold text-slate-700">Total do Pedido</span>
              <span className="text-xl font-black text-brand-600">
                R$ {orderTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary px-6 py-4">← Voltar</button>
            <button
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              className="btn-primary flex-1 py-4 text-base disabled:opacity-40"
            >
              {loading ? 'Salvando...' : '✓ Finalizar Pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
