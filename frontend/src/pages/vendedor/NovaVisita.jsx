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
  'À vista', '7 dias', '14 dias', '21 dias', '28 dias',
  '30/60 dias', '30/60/90 dias', 'Boleto 30 dias',
]

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-1 justify-center mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i <= current - 1 ? 'bg-brand-500 w-8' : 'bg-slate-200 w-4'}`}
        />
      ))}
    </div>
  )
}

const emptyForm = {
  client_id: '', newClient: false,
  client_name: '', client_phone: '', client_whatsapp: '',
  client_address: '', client_city: '', client_region: '',
  client_segment: '', client_responsible: '',
  visit_date: today,
  took_order: null,
  no_order_reason: '',
  classificacao_cliente: 'B',
  contato_atendeu: '', telefone_contato: '',
  next_purchase_date: '',
  competitor: '', competitor_price: '',
  bobine_type: 'manual', tube_type: 'com_tubo',
  monthly_volume: '', products_interest: '',
  observations: '',
  photo: null,
  // pré-orçamento
  gerou_orcamento: false,
  orcamento_desconto: 0,
  // follow-up
  data_followup: '', motivo_followup: '',
  // pedido (passo 3)
  payment_terms: '', delivery_date: '',
}

export default function NovaVisita() {
  const navigate = useNavigate()
  const [clients, setClients]   = useState([])
  const [products, setProducts] = useState([])
  const [step, setStep]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')

  const [form, setForm]         = useState(emptyForm)
  const [quoteItems, setQuoteItems] = useState([{ product_id: '', quantity: '', unit_price: '' }])
  const [orderItems, setOrderItems] = useState([{ product_id: '', quantity: '', unit_price: '' }])

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data))
    api.get('/products').catch(() => []).then(r => r.data && setProducts(r.data))
  }, [])

  const F = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const filteredClients = clients.filter(c =>
    !clientSearch ||
    (c.name || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.city || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone || '').includes(clientSearch)
  )

  const filteredProducts = products.filter(p =>
    !productSearch ||
    (p.nome || p.name || '').toLowerCase().includes(productSearch.toLowerCase())
  )

  // ── Quote helpers ──────────────────────────────────────────────
  const addQuoteItem   = () => setQuoteItems(p => [...p, { product_id: '', quantity: '', unit_price: '' }])
  const removeQuoteItem = i => setQuoteItems(p => p.filter((_, idx) => idx !== i))
  const updateQuoteItem = (i, k, v) => setQuoteItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it))

  const quoteSubtotal = quoteItems.reduce((acc, it) =>
    acc + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0)
  const quoteDiscount = parseFloat(form.orcamento_desconto) || 0
  const quoteTotal    = quoteSubtotal * (1 - quoteDiscount / 100)

  // ── Order helpers ──────────────────────────────────────────────
  const addOrderItem    = () => setOrderItems(p => [...p, { product_id: '', quantity: '', unit_price: '' }])
  const removeOrderItem = i  => setOrderItems(p => p.filter((_, idx) => idx !== i))
  const updateOrderItem = (i, k, v) => setOrderItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const orderTotal = orderItems.reduce((acc, it) =>
    acc + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0)

  const selectedClient  = clients.find(c => String(c.id) === String(form.client_id))
  const canGoToStep2    = form.newClient ? form.client_name.trim().length > 0 : !!form.client_id
  const canGoToStep3    = form.took_order !== null
  const validQuoteItems = quoteItems.filter(it => it.product_id && it.quantity)
  const validOrderItems = orderItems.filter(it => it.product_id && it.quantity)
  const canSubmit       = form.took_order !== null && (form.took_order ? validOrderItems.length > 0 : true)
  const totalSteps      = form.took_order === true ? 3 : 2

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(''); setLoading(true)
    try {
      let clientId = form.client_id

      if (form.newClient) {
        if (!form.client_name.trim()) { setError('Nome do cliente obrigatório'); setLoading(false); return }
        const r = await api.post('/clients', {
          name: form.client_name, phone: form.client_phone,
          whatsapp: form.client_whatsapp, address: form.client_address,
          city: form.client_city, region: form.client_region,
          segment: form.client_segment, responsible: form.client_responsible,
        })
        clientId = r.data.id
      }

      if (!clientId) { setError('Selecione ou cadastre um cliente'); setLoading(false); return }
      if (form.took_order === null) { setError('Informe se tirou pedido ou não'); setLoading(false); return }

      const visitData = new FormData()
      const fields = {
        client_id: clientId,
        visit_date: form.visit_date,
        took_order: form.took_order ? 1 : 0,
        no_order_reason: form.no_order_reason,
        next_contact_date: form.next_purchase_date,
        competitor: form.competitor,
        competitor_price: form.competitor_price,
        bobine_type: form.bobine_type,
        tube_type: form.tube_type,
        monthly_volume: form.monthly_volume,
        products_interest: form.products_interest,
        observations: form.observations,
        classificacao_cliente: form.classificacao_cliente || 'B',
        contato_atendeu: form.contato_atendeu,
        telefone_contato: form.telefone_contato,
        gerou_orcamento: form.gerou_orcamento ? 1 : 0,
        data_followup: form.data_followup,
        motivo_followup: form.motivo_followup,
        orcamento_total: validQuoteItems.length > 0 ? quoteTotal : '',
        orcamento_desconto: quoteDiscount,
        orcamento_items: validQuoteItems.length > 0 ? JSON.stringify(validQuoteItems.map(it => ({
          product_id: parseInt(it.product_id),
          product_name: products.find(p => String(p.id) === String(it.product_id))?.nome || '',
          quantity: parseFloat(it.quantity),
          unit_price: parseFloat(it.unit_price),
          subtotal: parseFloat(it.quantity) * parseFloat(it.unit_price),
        }))) : '',
      }
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) visitData.append(k, v)
      })
      if (form.photo) visitData.append('foto_fachada', form.photo)

      const vr = await api.post('/visits', visitData, { headers: { 'Content-Type': 'multipart/form-data' } })

      if (form.took_order && validOrderItems.length > 0) {
        await api.post('/orders', {
          client_id: clientId,
          visit_id: vr.data.id,
          condicao_pagamento: form.payment_terms || 'A_VISTA',
          payment_terms: form.payment_terms || 'A_VISTA',
          delivery_date: form.delivery_date || undefined,
          items: validOrderItems.map(it => ({
            product_id: parseInt(it.product_id),
            quantity: parseFloat(it.quantity),
            quantidade: parseFloat(it.quantity),
            unit_price: parseFloat(it.unit_price),
            preco_unitario: parseFloat(it.unit_price),
          })),
        })
      }

      navigate('/vendedor', { replace: true })
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Erro ao registrar. Tente novamente.')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <StepIndicator current={step} total={totalSteps} />

      {/* ── PASSO 1: CLIENTE ──────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-black text-slate-800 text-base mb-4">Qual cliente você visitou?</h2>
            <div className="flex gap-2 mb-4">
              <button onClick={() => { F('newClient', false); F('client_id', '') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${!form.newClient ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                Já cadastrado
              </button>
              <button onClick={() => { F('newClient', true); F('client_id', '') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${form.newClient ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                Novo cliente
              </button>
            </div>

            {!form.newClient ? (
              <div className="space-y-3">
                <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                  className="input" placeholder="Buscar por nome, cidade ou telefone..." />
                <div className="max-h-52 overflow-y-auto space-y-1.5">
                  {filteredClients.slice(0, 25).map(c => (
                    <button key={c.id} onClick={() => F('client_id', String(c.id))}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors border-2 ${String(form.client_id) === String(c.id) ? 'bg-brand-50 border-brand-400 text-brand-800' : 'bg-slate-50 border-transparent text-slate-700 hover:bg-slate-100'}`}>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{[c.city, c.segment, c.responsible].filter(Boolean).join(' · ')}</div>
                    </button>
                  ))}
                  {filteredClients.length === 0 && <p className="text-center py-4 text-slate-400 text-sm">Nenhum cliente encontrado</p>}
                </div>
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
                <div><label className="label">Nome / Empresa *</label>
                  <input value={form.client_name || ''} onChange={e => F('client_name', e.target.value)} className="input" placeholder="Razão social ou nome fantasia" /></div>
                <div><label className="label">Responsável pela compra</label>
                  <input value={form.client_responsible || ''} onChange={e => F('client_responsible', e.target.value)} className="input" placeholder="Nome do contato" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Telefone</label>
                    <input type="tel" value={form.client_phone || ''} onChange={e => F('client_phone', e.target.value)} className="input" placeholder="(11) 99999-9999" /></div>
                  <div><label className="label">WhatsApp</label>
                    <input type="tel" value={form.client_whatsapp || ''} onChange={e => F('client_whatsapp', e.target.value)} className="input" placeholder="(11) 99999-9999" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Cidade</label>
                    <input value={form.client_city || ''} onChange={e => F('client_city', e.target.value)} className="input" /></div>
                  <div><label className="label">Segmento</label>
                    <input value={form.client_segment || ''} onChange={e => F('client_segment', e.target.value)} className="input" placeholder="Ex: Supermercado" /></div>
                </div>
                <div><label className="label">Endereço</label>
                  <input value={form.client_address || ''} onChange={e => F('client_address', e.target.value)} className="input" /></div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <label className="label">Data da Visita</label>
            <input type="date" value={form.visit_date} onChange={e => F('visit_date', e.target.value)} className="input" max={today} />
          </div>

          <button onClick={() => setStep(2)} disabled={!canGoToStep2}
            className="btn-primary w-full py-4 text-base disabled:opacity-40">
            Próximo →
          </button>
        </div>
      )}

      {/* ── PASSO 2: RESULTADO + DETALHES ─────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">

          {/* Resultado da visita */}
          <div className="card p-5">
            <h2 className="font-black text-slate-800 text-base mb-4">Como foi a visita?</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => F('took_order', true)}
                className={`py-5 rounded-2xl text-center font-black transition-all border-2 ${form.took_order === true ? 'bg-green-500 text-white border-green-500 scale-105 shadow-lg shadow-green-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                <div className="text-3xl mb-1">✅</div>
                <div className="text-sm">Tirou Pedido</div>
              </button>
              <button onClick={() => F('took_order', false)}
                className={`py-5 rounded-2xl text-center font-black transition-all border-2 ${form.took_order === false ? 'bg-red-500 text-white border-red-500 scale-105 shadow-lg shadow-red-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                <div className="text-3xl mb-1">❌</div>
                <div className="text-sm">Sem Pedido</div>
              </button>
            </div>
            {form.took_order === false && (
              <div>
                <label className="label mb-2">Motivo de não fechar *</label>
                <div className="space-y-1.5">
                  {LOSS_REASONS.map(r => (
                    <button key={r} onClick={() => F('no_order_reason', r)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 ${form.no_order_reason === r ? 'bg-red-50 border-red-400 text-red-700' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Classificação */}
          <div className="card p-5">
            <label className="label mb-2">Classificação do cliente</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'A', icon: '⭐', desc: 'Alto potencial' },
                { v: 'B', icon: '🔵', desc: 'Médio potencial' },
                { v: 'C', icon: '⚪', desc: 'Baixo potencial' },
              ].map(c => (
                <button key={c.v} type="button" onClick={() => F('classificacao_cliente', c.v)}
                  className={`py-3 rounded-xl border-2 transition-all text-center ${form.classificacao_cliente === c.v ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <div className="text-lg">{c.icon}</div>
                  <div className="text-sm font-black">{c.v}</div>
                  <div className="text-xs opacity-80">{c.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Contato + telefone */}
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-slate-700 text-sm">Contato na visita</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nome de quem atendeu</label>
                <input value={form.contato_atendeu} onChange={e => F('contato_atendeu', e.target.value)} className="input" placeholder="Nome" /></div>
              <div><label className="label">Telefone</label>
                <input type="tel" value={form.telefone_contato} onChange={e => F('telefone_contato', e.target.value)} className="input" placeholder="(11) 99999-9999" /></div>
            </div>
          </div>

          {/* Pré-orçamento */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700 text-sm">Pré-Orçamento <span className="text-slate-400 font-normal">(opcional)</span></h3>
              <span className="text-xs text-slate-400">Não cria pedido</span>
            </div>

            <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
              className="input text-sm" placeholder="Buscar produto..." />

            <div className="space-y-3">
              {quoteItems.map((item, i) => {
                const prod = products.find(p => String(p.id) === String(item.product_id))
                return (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Item {i + 1}</span>
                      {i > 0 && <button onClick={() => removeQuoteItem(i)} className="text-red-400 text-xs font-semibold">Remover</button>}
                    </div>
                    <select value={item.product_id}
                      onChange={e => {
                        const p = products.find(x => String(x.id) === e.target.value)
                        updateQuoteItem(i, 'product_id', e.target.value)
                        if (p) updateQuoteItem(i, 'unit_price', p.preco_unitario || p.unit_price || '')
                      }}
                      className="input text-sm">
                      <option value="">Selecione o produto...</option>
                      {filteredProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome || p.name} — R$ {Number(p.preco_unitario || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">Qtd</label>
                        <input type="number" value={item.quantity}
                          onChange={e => updateQuoteItem(i, 'quantity', e.target.value)}
                          className="input text-base font-bold" min="1" placeholder="0" /></div>
                      <div><label className="label">Preço unit. (R$)</label>
                        <input type="number" value={item.unit_price}
                          onChange={e => updateQuoteItem(i, 'unit_price', e.target.value)}
                          className="input" step="0.01" placeholder="0,00" /></div>
                    </div>
                    {item.quantity && item.unit_price && (
                      <div className="text-right text-sm font-bold text-brand-600">
                        R$ {((parseFloat(item.quantity)||0)*(parseFloat(item.unit_price)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={addQuoteItem} className="btn-secondary w-full py-2.5 text-sm">+ Produto</button>

            {quoteSubtotal > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <label className="label flex-1 mb-0">Desconto (%)</label>
                  <input type="number" value={form.orcamento_desconto}
                    onChange={e => F('orcamento_desconto', e.target.value)}
                    className="input w-24 text-center" min="0" max="100" step="0.5" placeholder="0" />
                </div>
                <div className="bg-brand-50 border-2 border-brand-200 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-500">Subtotal: R$ {quoteSubtotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                    {quoteDiscount > 0 && <div className="text-xs text-green-600">Desconto {quoteDiscount}%</div>}
                  </div>
                  <span className="text-lg font-black text-brand-600">
                    R$ {quoteTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Follow-up */}
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-slate-700 text-sm">Follow-up <span className="text-slate-400 font-normal">(opcional)</span></h3>
            <div><label className="label">Data do próximo contato</label>
              <input type="date" value={form.data_followup}
                onChange={e => F('data_followup', e.target.value)}
                className="input" min={today} /></div>
            {form.data_followup && (
              <div><label className="label">Motivo / o que combinar</label>
                <input value={form.motivo_followup}
                  onChange={e => F('motivo_followup', e.target.value)}
                  className="input" placeholder="Ex: Aguardando decisão do gerente..." /></div>
            )}
          </div>

          {/* Informações comerciais */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-700 text-sm">Informações Comerciais</h3>
            <div><label className="label">Previsão próxima compra</label>
              <input type="date" value={form.next_purchase_date} onChange={e => F('next_purchase_date', e.target.value)} className="input" min={today} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Tipo de Bobine</label>
                <select value={form.bobine_type} onChange={e => F('bobine_type', e.target.value)} className="input">
                  <option value="manual">Manual</option>
                  <option value="automatica">Automática</option>
                  <option value="ambas">Ambas</option>
                </select></div>
              <div><label className="label">Uso de Tubo</label>
                <select value={form.tube_type} onChange={e => F('tube_type', e.target.value)} className="input">
                  <option value="com_tubo">Com Tubo</option>
                  <option value="sem_tubo">Sem Tubo</option>
                  <option value="ambos">Ambos</option>
                </select></div>
            </div>
            <div><label className="label">Volume mensal estimado (unidades)</label>
              <input type="number" value={form.monthly_volume} onChange={e => F('monthly_volume', e.target.value)} className="input" placeholder="Ex: 200" min="0" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Concorrente atual</label>
                <input value={form.competitor} onChange={e => F('competitor', e.target.value)} className="input" placeholder="Ex: FilmePro" /></div>
              <div><label className="label">Preço concorrente (R$)</label>
                <input type="number" value={form.competitor_price} onChange={e => F('competitor_price', e.target.value)} className="input" step="0.01" placeholder="0,00" /></div>
            </div>
            <div><label className="label">Produtos de interesse</label>
              <input value={form.products_interest} onChange={e => F('products_interest', e.target.value)} className="input" placeholder="Ex: Filme 25cm manual, Fita 48mm..." /></div>
            <div><label className="label">Observações da visita</label>
              <textarea value={form.observations} onChange={e => F('observations', e.target.value)} className="input" rows={3} placeholder="Anotações importantes..." /></div>
            <div><label className="label">Foto da fachada — opcional</label>
              <input type="file" accept="image/*" capture="environment" onChange={e => F('photo', e.target.files[0])} className="input text-sm" /></div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary px-6 py-4">← Voltar</button>
            {form.took_order === true ? (
              <button onClick={() => { setError(''); setStep(3) }} disabled={!canGoToStep3}
                className="btn-primary flex-1 py-4 text-base disabled:opacity-40">
                Adicionar Produtos →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading || form.took_order === null}
                className="btn-primary flex-1 py-4 text-base disabled:opacity-40">
                {loading ? 'Salvando...' : '✓ Finalizar Visita'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PASSO 3: PEDIDO ───────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-black text-slate-800 text-base mb-4">Produtos do Pedido</h2>
            <div className="space-y-3">
              {orderItems.map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">Produto {i + 1}</span>
                    {i > 0 && <button onClick={() => removeOrderItem(i)} className="text-red-400 text-xs font-semibold">Remover</button>}
                  </div>
                  <div><label className="label">Produto</label>
                    <select value={item.product_id}
                      onChange={e => {
                        const p = products.find(x => String(x.id) === e.target.value)
                        updateOrderItem(i, 'product_id', e.target.value)
                        if (p) updateOrderItem(i, 'unit_price', p.preco_unitario || p.unit_price || '')
                      }}
                      className="input">
                      <option value="">Selecione o produto...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome || p.name} — R$ {Number(p.preco_unitario || 0).toFixed(2)}
                        </option>
                      ))}
                    </select></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">Quantidade</label>
                      <input type="number" value={item.quantity}
                        onChange={e => updateOrderItem(i, 'quantity', e.target.value)}
                        className="input text-lg font-bold" min="1" placeholder="0" /></div>
                    <div><label className="label">Preço unit. (R$)</label>
                      <input type="number" value={item.unit_price}
                        onChange={e => updateOrderItem(i, 'unit_price', e.target.value)}
                        className="input" step="0.01" placeholder="0,00" /></div>
                  </div>
                  {item.quantity && item.unit_price && (
                    <div className="text-right text-sm font-bold text-brand-600">
                      Subtotal: R$ {((parseFloat(item.quantity)||0)*(parseFloat(item.unit_price)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addOrderItem} className="btn-secondary w-full mt-3 py-3 text-sm">+ Adicionar Produto</button>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-700 text-sm">Condições do Pedido</h3>
            <div><label className="label">Prazo de Pagamento</label>
              <select value={form.payment_terms} onChange={e => F('payment_terms', e.target.value)} className="input">
                <option value="">Selecione...</option>
                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className="label">Data de Entrega Prevista</label>
              <input type="date" value={form.delivery_date} onChange={e => F('delivery_date', e.target.value)} className="input" min={today} /></div>
          </div>

          {orderTotal > 0 && (
            <div className="bg-brand-50 border-2 border-brand-200 rounded-2xl p-4 flex items-center justify-between">
              <span className="font-bold text-slate-700">Total do Pedido</span>
              <span className="text-xl font-black text-brand-600">
                R$ {orderTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}
              </span>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary px-6 py-4">← Voltar</button>
            <button onClick={handleSubmit} disabled={loading || !canSubmit}
              className="btn-primary flex-1 py-4 text-base disabled:opacity-40">
              {loading ? 'Salvando...' : '✓ Finalizar Pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
