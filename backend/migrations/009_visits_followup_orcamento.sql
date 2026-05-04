-- Novos campos para pré-orçamento e follow-up na tabela visits
ALTER TABLE visits ADD COLUMN IF NOT EXISTS data_followup DATE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS motivo_followup VARCHAR(255);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS orcamento_items JSONB;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS orcamento_total DECIMAL(10,2);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS orcamento_desconto DECIMAL(5,2) DEFAULT 0;
-- Campos da migration 008 (idempotente)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS classificacao_cliente VARCHAR(1) DEFAULT 'B';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS contato_atendeu VARCHAR(100);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS telefone_contato VARCHAR(20);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS gerou_orcamento BOOLEAN DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS valor_orcamento DECIMAL(10,2);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS foto_fachada_url TEXT;
