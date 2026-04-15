-- Habilitar extensão de UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de schema migrations para controle de versão
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);

-- Usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin','vendedor','producao','motorista')),
  active BOOLEAN DEFAULT true,
  phone VARCHAR(20),
  refresh_token TEXT,
  refresh_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  razao_social VARCHAR(200),
  nome_fantasia VARCHAR(200),
  company_name VARCHAR(200),
  cnpj VARCHAR(18) UNIQUE,
  address TEXT,
  endereco TEXT,
  city VARCHAR(100),
  cidade VARCHAR(100),
  state VARCHAR(2),
  estado VARCHAR(2),
  cep VARCHAR(9),
  region VARCHAR(100),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(150),
  contato_nome VARCHAR(100),
  contato_telefone VARCHAR(20),
  contato_email VARCHAR(150),
  segment VARCHAR(100),
  responsible VARCHAR(100),
  tipo_cliente VARCHAR(20) DEFAULT 'OUTROS' CHECK (tipo_cliente IN ('INDUSTRIA','REVENDA','DISTRIBUIDOR','OUTROS')),
  limite_credito DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(10) DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','BLOQUEADO','INATIVO')),
  bloqueio_motivo TEXT,
  seller_id INT REFERENCES users(id),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Produtos (novo, substitui skus)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  code VARCHAR(50),
  name VARCHAR(200),
  tipo VARCHAR(10) DEFAULT 'STRETCH' CHECK (tipo IN ('STRETCH','FITA')),
  gramatura DECIMAL(8,2),
  metragem INT,
  largura DECIMAL(8,2),
  descricao TEXT,
  description TEXT,
  preco_unitario DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  unidade VARCHAR(10) DEFAULT 'ROLO' CHECK (unidade IN ('KG','ROLO','CAIXA')),
  unit VARCHAR(20),
  category VARCHAR(100),
  min_stock INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- SKUs (mantido para compatibilidade com estoque existente)
CREATE TABLE IF NOT EXISTS skus (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  type VARCHAR(50),
  weight DECIMAL(8,2),
  unit VARCHAR(20),
  unit_price DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  min_stock INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stock
CREATE TABLE IF NOT EXISTS stock (
  id SERIAL PRIMARY KEY,
  sku_id INT REFERENCES skus(id),
  quantity_physical INT DEFAULT 0,
  quantity_reserved INT DEFAULT 0,
  quantity_available INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Visitas
CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  seller_id INT REFERENCES users(id),
  client_id INT REFERENCES clients(id),
  cliente_nome VARCHAR(200),
  cnpj VARCHAR(18),
  endereco TEXT,
  contato VARCHAR(100),
  tipo_cliente VARCHAR(20),
  status VARCHAR(30) DEFAULT 'visitado',
  status_visita VARCHAR(30),
  result VARCHAR(20),
  notes TEXT,
  observacoes TEXT,
  volume_estimado_kg DECIMAL(10,2),
  visit_date DATE,
  data_visita DATE,
  next_contact_date DATE,
  order_id INT,
  loss_reason TEXT,
  competitor VARCHAR(100),
  competitor_price DECIMAL(10,2),
  product_interest TEXT,
  monthly_volume DECIMAL(10,2),
  tube_type VARCHAR(50),
  has_location BOOLEAN DEFAULT false,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES clients(id),
  seller_id INT REFERENCES users(id),
  visit_id INT REFERENCES visits(id),
  origem VARCHAR(20) DEFAULT 'VENDEDOR',
  status VARCHAR(30) DEFAULT 'pendente',
  payment_status VARCHAR(20) DEFAULT 'pendente',
  invoice_number VARCHAR(50),
  condicao_pagamento VARCHAR(20) DEFAULT 'A_VISTA',
  payment_terms TEXT,
  delivery_date DATE,
  notes TEXT,
  observacoes TEXT,
  total_value DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) DEFAULT 0,
  delivery_status VARCHAR(20) DEFAULT 'AGUARDANDO',
  driver_id INT REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_attempts INT DEFAULT 0,
  delivery_notes TEXT,
  delivery_proof_url TEXT,
  delivery_photo_url TEXT,
  delivery_signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Itens de pedido
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  sku_id INT REFERENCES skus(id),
  product_id INT REFERENCES products(id),
  quantity DECIMAL(10,2) DEFAULT 1,
  quantidade DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  preco_unitario DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Histórico de status de pedidos
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  campo_alterado VARCHAR(30) DEFAULT 'status',
  changed_by INT REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  observacao TEXT
);

-- Produção
CREATE TABLE IF NOT EXISTS production_orders (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  status VARCHAR(30) DEFAULT 'pendente',
  operator_id INT REFERENCES users(id),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Movimentações de estoque
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  sku_id INT REFERENCES skus(id),
  type VARCHAR(30) NOT NULL,
  quantity DECIMAL(10,2),
  reason TEXT,
  reference_id INT,
  operator_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Veículos
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  model VARCHAR(100),
  plate VARCHAR(20),
  driver_id INT REFERENCES users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rotas de entrega
CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  driver_id INT REFERENCES users(id),
  vehicle_id INT REFERENCES vehicles(id),
  route_date DATE,
  status VARCHAR(20) DEFAULT 'planejada',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entregas
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  route_id INT REFERENCES routes(id),
  driver_id INT REFERENCES users(id),
  client_id INT REFERENCES clients(id),
  status VARCHAR(30) DEFAULT 'pendente',
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  completion_time TIMESTAMPTZ,
  tubes_had BOOLEAN DEFAULT false,
  tubes_quantity INT DEFAULT 0,
  tubes_p5 INT DEFAULT 0,
  tubes_p10 INT DEFAULT 0,
  tubes_pending BOOLEAN DEFAULT false,
  tubes_pending_qty INT DEFAULT 0,
  tubes_pending_p5 INT DEFAULT 0,
  tubes_pending_p10 INT DEFAULT 0,
  tubes_obs TEXT,
  tubes_payment_status VARCHAR(20) DEFAULT 'pendente',
  tubes_qty_p5 INT DEFAULT 0,
  tubes_qty_p10 INT DEFAULT 0,
  canhoto_photo TEXT,
  no_proof_reason TEXT,
  observations TEXT,
  acted_by_id INT,
  acted_by_role VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fotos de canhoto
CREATE TABLE IF NOT EXISTS canhoto_photos (
  id SERIAL PRIMARY KEY,
  delivery_id INT REFERENCES deliveries(id),
  filename TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Auditoria
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(100),
  table_name VARCHAR(50),
  record_id VARCHAR(50),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);
