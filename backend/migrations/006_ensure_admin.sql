-- Migration 006: garantir usuário admin com email correto e senha admin123
-- Hash bcryptjs de 'admin123' (10 rounds)
-- $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

-- Remover admin antigo com email errado se existir e não houver dados vinculados
DELETE FROM users
WHERE email = 'admin@pack61.com'
  AND NOT EXISTS (SELECT 1 FROM orders WHERE seller_id = users.id)
  AND NOT EXISTS (SELECT 1 FROM visits  WHERE seller_id = users.id);

-- Inserir ou atualizar admin com email correto
INSERT INTO users (name, email, password_hash, role, active, created_at, updated_at)
VALUES (
  'Administrador',
  'admin@pack61.com.br',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'admin',
  true,
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE
  SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      role          = 'admin',
      active        = true,
      updated_at    = now();
