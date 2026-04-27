-- Novos campos na tabela visits para módulo de vendedores
ALTER TABLE visits ADD COLUMN IF NOT EXISTS classificacao_cliente VARCHAR(1) DEFAULT 'B' CHECK (classificacao_cliente IN ('A','B','C'));
ALTER TABLE visits ADD COLUMN IF NOT EXISTS contato_atendeu VARCHAR(100);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS telefone_contato VARCHAR(20);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS gerou_orcamento BOOLEAN DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS valor_orcamento DECIMAL(10,2);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS foto_fachada_url TEXT;
