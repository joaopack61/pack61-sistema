'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config();

const { initDatabase } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3001;

// Criar pasta de uploads se não existir
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(uploadsDir));

// Rotas da API
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/clients',    require('./routes/clients'));
app.use('/api/visits',     require('./routes/visits'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/production', require('./routes/production'));
app.use('/api/stock',      require('./routes/stock'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/reports',    require('./routes/reports'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', company: 'Pack61' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor', message: err.message });
});

// ─── Inicialização assíncrona (sql.js precisa de await) ───────────────────────
async function main() {
  try {
    console.log('[Pack61] Iniciando banco de dados (sql.js)...');
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`\n  Pack61 Backend rodando na porta ${PORT}`);
      console.log(`  Acesse: http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error('[Pack61] Falha ao iniciar:', err);
    process.exit(1);
  }
}

main();
