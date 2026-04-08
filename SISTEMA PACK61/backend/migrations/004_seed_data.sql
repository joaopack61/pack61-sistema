-- Admin padrão (senha: admin123)
INSERT INTO users (name, email, password_hash, role, active)
VALUES ('Administrador', 'admin@pack61.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- Vendedor demo (senha: senha123)
INSERT INTO users (name, email, password_hash, role, active)
VALUES ('João Vendedor', 'joao@pack61.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'vendedor', true)
ON CONFLICT (email) DO NOTHING;

-- Motorista demo (senha: senha123)
INSERT INTO users (name, email, password_hash, role, active)
VALUES ('Carlos Motorista', 'carlos@pack61.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'motorista', true)
ON CONFLICT (email) DO NOTHING;

-- Produção demo (senha: senha123)
INSERT INTO users (name, email, password_hash, role, active)
VALUES ('Ana Produção', 'ana@pack61.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'producao', true)
ON CONFLICT (email) DO NOTHING;

-- Clientes demo
INSERT INTO clients (name, razao_social, cnpj, city, estado, phone, tipo_cliente, status, active, ativo)
VALUES
  ('Embalagens ABC Ltda', 'Embalagens ABC Ltda', '12.345.678/0001-90', 'São Paulo', 'SP', '(11) 9999-1111', 'INDUSTRIA', 'ATIVO', true, true),
  ('Distribuidora XYZ', 'Distribuidora XYZ ME', '98.765.432/0001-10', 'Campinas', 'SP', '(19) 9888-2222', 'DISTRIBUIDOR', 'ATIVO', true, true),
  ('Supermercado Central', 'Central Comércio SA', '11.222.333/0001-44', 'Santos', 'SP', '(13) 9777-3333', 'REVENDA', 'ATIVO', true, true)
ON CONFLICT (cnpj) DO NOTHING;

-- Produtos demo
INSERT INTO products (nome, tipo, gramatura, metragem, largura, preco_unitario, unidade, ativo, active)
VALUES
  ('Filme Stretch Manual 500g', 'STRETCH', 500, 300, 50, 8.50, 'ROLO', true, true),
  ('Filme Stretch Manual 1kg', 'STRETCH', 1000, 400, 50, 15.00, 'ROLO', true, true),
  ('Filme Stretch Automático 2kg', 'STRETCH', 2000, 1000, 50, 28.00, 'ROLO', true, true),
  ('Fita Adesiva Transparente 45mm', 'FITA', null, 50, 45, 4.50, 'ROLO', true, true),
  ('Fita Adesiva Marrom 48mm', 'FITA', null, 50, 48, 5.00, 'ROLO', true, true)
ON CONFLICT DO NOTHING;
