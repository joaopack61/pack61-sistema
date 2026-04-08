-- Pagamentos de pedidos
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  client_id INT REFERENCES clients(id),
  valor DECIMAL(10,2) NOT NULL,
  forma_pagamento VARCHAR(20) DEFAULT 'BOLETO' CHECK (forma_pagamento IN ('BOLETO','PIX','TRANSFERENCIA','DINHEIRO')),
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(10) DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','PAGO','ATRASADO')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Controle financeiro de tubos
CREATE TABLE IF NOT EXISTS tube_financial (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  delivery_id INT REFERENCES deliveries(id),
  client_id INT REFERENCES clients(id),
  driver_id INT REFERENCES users(id),
  quantidade_p5 INT DEFAULT 0,
  quantidade_p10 INT DEFAULT 0,
  valor_p5 DECIMAL(10,2) DEFAULT 0,
  valor_p10 DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) DEFAULT 0,
  status_pagamento VARCHAR(10) DEFAULT 'PENDENTE',
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log de notificações
CREATE TABLE IF NOT EXISTS notification_log (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  client_id INT REFERENCES clients(id),
  canal VARCHAR(20) DEFAULT 'WHATSAPP',
  mensagem TEXT,
  status VARCHAR(20) DEFAULT 'SIMULADO',
  sent_at TIMESTAMPTZ DEFAULT now()
);
