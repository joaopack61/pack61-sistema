-- Ampliar campo condicao_pagamento para aceitar texto livre (ex: "7/14", "30/60/90 dias")
ALTER TABLE orders ALTER COLUMN condicao_pagamento TYPE VARCHAR(50);
