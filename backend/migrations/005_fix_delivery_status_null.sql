-- Corrigir pedidos antigos com delivery_status NULL
UPDATE orders SET delivery_status = 'AGUARDANDO' WHERE delivery_status IS NULL;

-- Pedidos já em pronto_expedicao que não foram visíveis para motoristas
UPDATE orders
SET delivery_status = 'DISPONIVEL'
WHERE status = 'pronto_expedicao'
  AND delivery_status = 'AGUARDANDO';

-- Pedidos já entregues
UPDATE orders
SET delivery_status = 'ENTREGUE'
WHERE status = 'entregue'
  AND delivery_status != 'ENTREGUE';

-- Garantir NOT NULL com default para registros futuros
ALTER TABLE orders
  ALTER COLUMN delivery_status SET DEFAULT 'AGUARDANDO';

ALTER TABLE orders
  ALTER COLUMN delivery_status SET NOT NULL;
