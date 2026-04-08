'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config();

const { initDatabase } = require('./database');

const app        = express();
const PORT       = process.env.PORT || 3001;
const IS_PROD    = process.env.NODE_ENV === 'production';

// ─── Uploads: configurável via env para persistência no volume do Railway ─────
const uploadsDir = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── CORS ────────────────────────────────────────────────────────────────────
// Em produção aceita qualquer origem (Railway serve frontend e backend no mesmo host)
// Em desenvolvimento aceita localhost:5173 (Vite dev server)
app.use(cors({
  origin: IS_PROD ? true : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true,
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(uploadsDir));

// ─── Rotas da API ─────────────────────────────────────────────────────────────
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

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', company: 'Pack61', env: process.env.NODE_ENV || 'development' })
);

// ─── Frontend estático (React buildado pelo Vite) ────────────────────────────
// O Railway executa "npm run build" antes de "npm start", gerando frontend/dist/
const frontendDist = path.join(__dirname, '../frontend/dist');
const indexHtml    = path.join(frontendDist, 'index.html');

if (fs.existsSync(frontendDist)) {
  console.log('[Pack61] Frontend servido de:', frontendDist);
} else {
  console.warn('[Pack61] AVISO: frontend/dist nao encontrado. Rode "npm run build" primeiro.');
}

// Registra os middlewares SEMPRE (independente do build existir)
// para garantir que as rotas estejam ativas quando o servidor sobe
app.use(express.static(frontendDist));

// SPA fallback: qualquer rota que nao seja /api ou /uploads devolve o index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Rota nao encontrada' });
  }
  res.sendFile(indexHtml, (err) => {
    if (err) res.status(404).send('Frontend nao buildado. Execute: npm run build');
  });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor', message: err.message });
});

// ─── Inicialização (sql.js é assíncrono) ─────────────────────────────────────
async function main() {
  try {
    console.log('[Pack61] Iniciando banco de dados (sql.js WASM)...');
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  Pack61 rodando na porta ${PORT}`);
      if (!IS_PROD) console.log(`  Acesse: http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('[Pack61] Falha ao iniciar:', err);
    process.exit(1);
  }
}

main();
