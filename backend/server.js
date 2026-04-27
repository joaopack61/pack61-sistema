'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config();

const { initDatabase } = require('./database');

const app     = express();
const PORT    = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// Uploads
const uploadsDir = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// CORS
app.use(cors({
  origin: IS_PROD ? true : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true,
}));

app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(uploadsDir));

// Health check — ANTES de qualquer rota autenticada (Railway verifica isso)
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', company: 'Pack61', version: '2.0', env: process.env.NODE_ENV || 'development' })
);

// Rotas da API
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/clients',    require('./routes/clients'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/visits',     require('./routes/visits'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/production', require('./routes/production'));
app.use('/api/stock',      require('./routes/stock'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/financial',  require('./routes/financial'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/sellers',    require('./routes/sellers'));

// Frontend
const frontendDist = path.join(__dirname, '../frontend/dist');
const indexHtml    = path.join(frontendDist, 'index.html');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  res.sendFile(indexHtml, err => {
    if (err) res.status(404).send('Frontend não buildado. Execute: npm run build');
  });
});

async function main() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  Pack61 ERP v2.0 rodando na porta ${PORT}`);
    });
  } catch (err) {
    console.error('[Pack61] Falha ao iniciar:', err);
    process.exit(1);
  }
}

main();
