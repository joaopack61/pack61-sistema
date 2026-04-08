const STATUS_MAP = {
  pendente:          { label: 'Pendente',         cls: 'badge-pendente' },
  em_producao:       { label: 'Em Producao',      cls: 'badge-em_producao' },
  produzido:         { label: 'Produzido',         cls: 'badge-produzido' },
  pronto_expedicao:  { label: 'Pronto p/ Exp.',   cls: 'badge-pronto_expedicao' },
  entregue:          { label: 'Entregue',          cls: 'badge-entregue' },
  cancelado:         { label: 'Cancelado',         cls: 'badge-cancelado' },
  saiu_entrega:      { label: 'Saiu p/ Entrega',  cls: 'badge-saiu_entrega' },
  chegou_cliente:    { label: 'No Cliente',        cls: 'badge-saiu_entrega' },
  ocorrencia:        { label: 'Ocorrencia',        cls: 'badge-ocorrencia' },
  nao_entregue:      { label: 'Nao Entregue',      cls: 'badge-nao_entregue' },
}

export default function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status || '-', cls: 'bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full' }
  return <span className={s.cls}>{s.label}</span>
}
