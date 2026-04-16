-- Ampliar coluna version da tabela de controle de migrations
-- (necessário pois nomes de arquivo excedem VARCHAR(20))
ALTER TABLE schema_migrations ALTER COLUMN version TYPE VARCHAR(100);

-- Corrigir pedidos antigos com delivery_status NULL
UPDATE orders SET delivery_status = 'AGUARDANDO' WHERE delivery_status IS NULL;

-- Pedidos já em pronto_expedicao que não ficaram visíveis para motoristas
UPDATE orders
SET delivery_status = 'DISPONIVEL'
WHERE status = 'pronto_expedicao'
  AND delivery_status = 'AGUARDANDO';

-- Pedidos já entregues com delivery_status inconsistente
UPDATE orders
SET delivery_status = 'ENTREGUE'
WHERE status = 'entregue'
  AND delivery_status != 'ENTREGUE';

-- Garantir default para registros futuros
ALTER TABLE orders
  ALTER COLUMN delivery_status SET DEFAULT 'AGUARDANDO';
