'use strict';
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
        ? { rejectUnauthorized: false }
        : false,
    });
    pool.on('error', (err) => {
      console.error('[Pack61] Erro no pool do PostgreSQL:', err.message);
    });
  }
  return pool;
}

// Executar query simples
async function query(sql, params = []) {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// Obter cliente para transações manuais
async function getClient() {
  return getPool().connect();
}

// Log de auditoria assíncrono
async function auditLog(userId, action, tableName, recordId, oldValues = null, newValues = null) {
  try {
    await query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId || null, action, tableName, String(recordId || ''), oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null]
    );
  } catch (e) {
    console.error('[Pack61] auditLog erro:', e.message);
  }
}

// Migrations versionadas
async function runMigrations() {
  const migDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migDir)) return;

  // Garantir tabela de controle
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(20) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const version = file.replace('.sql', '');
    const already = await query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    if (already.rows.length > 0) {
      console.log(`[Pack61] Migration ${version} já aplicada — pulando`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
    try {
      await query(sql);
      await query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      console.log(`[Pack61] Migration ${version} aplicada com sucesso`);
    } catch (e) {
      console.error(`[Pack61] Erro na migration ${version}:`, e.message);
      throw e;
    }
  }
}

async function initDatabase() {
  console.log('[Pack61] Conectando ao PostgreSQL...');
  await runMigrations();
  console.log('[Pack61] Banco de dados pronto.');
}

module.exports = { initDatabase, query, getClient, auditLog, getPool };
