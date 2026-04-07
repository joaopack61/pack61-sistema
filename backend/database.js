'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  database.js — Pack61
//  Usa sql.js (SQLite compilado para WASM, zero dependência nativa).
//  Exporta getDb() com API idêntica ao better-sqlite3 para que as rotas
//  não precisem ser alteradas.
// ─────────────────────────────────────────────────────────────────────────────

const fs       = require('fs');
const path     = require('path');
const bcrypt   = require('bcryptjs');

const DB_PATH  = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'pack61.db');

let _SQL = null;   // sql.js namespace (aguarda initDb)
let _db  = null;   // instância sql.js Database
let _inTx = false; // flag: está dentro de transaction()

// ─── Persistência ─────────────────────────────────────────────────────────────

function _flush() {
  if (_db) {
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

let _flushTimer = null;
function _scheduleSave() {
  if (_inTx) return; // não salvar no meio de uma transação
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => { _flushTimer = null; _flush(); }, 200);
}

// ─── Normalização de linha (BigInt → Number) ──────────────────────────────────

function _normalizeRow(row) {
  if (!row) return row;
  for (const k of Object.keys(row)) {
    if (typeof row[k] === 'bigint') row[k] = Number(row[k]);
  }
  return row;
}

// ─── Wrapper de Statement (imita better-sqlite3 PreparedStatement) ────────────

class Statement {
  constructor(sql) {
    this._sql = sql;
  }

  _bind(args) {
    // Achata 1 nível (permite passar array ou valores individuais)
    const flat = Array.isArray(args[0]) && args.length === 1 ? args[0] : args;
    return flat.length > 0 ? flat : null;
  }

  /** Retorna primeira linha ou undefined */
  get(...args) {
    const stmt = _db.prepare(this._sql);
    const p = this._bind(args);
    if (p) stmt.bind(p);
    let row;
    if (stmt.step()) row = _normalizeRow(stmt.getAsObject());
    stmt.free();
    return row;
  }

  /** Retorna array de linhas */
  all(...args) {
    const stmt = _db.prepare(this._sql);
    const p = this._bind(args);
    if (p) stmt.bind(p);
    const rows = [];
    while (stmt.step()) rows.push(_normalizeRow(stmt.getAsObject()));
    stmt.free();
    return rows;
  }

  /** Executa INSERT/UPDATE/DELETE — retorna { lastInsertRowid, changes } */
  run(...args) {
    const p = this._bind(args);
    if (p) _db.run(this._sql, p);
    else   _db.run(this._sql);

    const lastRow = _db.exec('SELECT last_insert_rowid() AS id');
    const lastInsertRowid = Number(lastRow[0]?.values[0]?.[0] ?? 0);
    _scheduleSave();
    return { lastInsertRowid, changes: 1 };
  }
}

// ─── Wrapper de Database (imita better-sqlite3 Database) ─────────────────────

class DbWrapper {
  prepare(sql) {
    return new Statement(sql);
  }

  exec(sql) {
    _db.run(sql);
    _scheduleSave();
  }

  // Suporta: db.transaction(fn)() como better-sqlite3
  transaction(fn) {
    return (...args) => {
      _inTx = true;
      _db.run('BEGIN');
      try {
        const result = fn(...args);
        _db.run('COMMIT');
        _inTx = false;
        _flush(); // salvar imediatamente após commit
        return result;
      } catch (e) {
        try { _db.run('ROLLBACK'); } catch {}
        _inTx = false;
        throw e;
      }
    };
  }
}

const _wrapper = new DbWrapper();

function getDb() {
  if (!_db) throw new Error('[Pack61] Banco não inicializado. Chame initDatabase() primeiro.');
  return _wrapper;
}

// ─── Auditoria ─────────────────────────────────────────────────────────────────

function auditLog(userId, action, tableName, recordId, details = {}) {
  if (!_db) return;
  try {
    _db.run(
      'INSERT INTO audit_logs (user_id, action, table_name, record_id, details) VALUES (?,?,?,?,?)',
      [userId || null, action, tableName || null, recordId || null, JSON.stringify(details)]
    );
    _scheduleSave();
  } catch {}
}

// ─── Schema ───────────────────────────────────────────────────────────────────

function _createSchema() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       name          TEXT    NOT NULL,
       email         TEXT    UNIQUE NOT NULL,
       password_hash TEXT    NOT NULL,
       role          TEXT    CHECK(role IN ('admin','vendedor','motorista','producao')) NOT NULL,
       phone         TEXT,
       active        INTEGER DEFAULT 1,
       last_login    DATETIME,
       created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS clients (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       name          TEXT NOT NULL,
       company_name  TEXT,
       cnpj          TEXT,
       address       TEXT,
       city          TEXT,
       region        TEXT,
       state         TEXT DEFAULT 'SP',
       cep           TEXT,
       phone         TEXT,
       whatsapp      TEXT,
       email         TEXT,
       segment       TEXT,
       responsible   TEXT,
       seller_id     INTEGER REFERENCES users(id),
       notes         TEXT,
       active        INTEGER DEFAULT 1,
       created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS visits (
       id                 INTEGER PRIMARY KEY AUTOINCREMENT,
       client_id          INTEGER REFERENCES clients(id),
       seller_id          INTEGER REFERENCES users(id),
       visit_date         TEXT    NOT NULL,
       took_order         INTEGER DEFAULT 0,
       no_order_reason    TEXT,
       next_purchase_date TEXT,
       competitor         TEXT,
       competitor_price   REAL,
       bobine_type        TEXT,
       tube_type          TEXT,
       monthly_volume     REAL,
       products_interest  TEXT,
       observations       TEXT,
       lat                REAL,
       lng                REAL,
       photo              TEXT,
       created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS skus (
       id           INTEGER PRIMARY KEY AUTOINCREMENT,
       code         TEXT UNIQUE NOT NULL,
       name         TEXT NOT NULL,
       category     TEXT,
       type         TEXT,
       weight       REAL,
       unit         TEXT DEFAULT 'RL',
       min_stock    INTEGER DEFAULT 0,
       unit_cost    REAL DEFAULT 0,
       observations TEXT,
       active       INTEGER DEFAULT 1,
       created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS stock (
       id                 INTEGER PRIMARY KEY AUTOINCREMENT,
       sku_id             INTEGER UNIQUE REFERENCES skus(id),
       quantity_physical  INTEGER DEFAULT 0,
       quantity_reserved  INTEGER DEFAULT 0,
       quantity_available INTEGER DEFAULT 0,
       updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS stock_movements (
       id           INTEGER PRIMARY KEY AUTOINCREMENT,
       sku_id       INTEGER REFERENCES skus(id),
       type         TEXT,
       quantity     INTEGER NOT NULL,
       reason       TEXT,
       reference_id INTEGER,
       operator_id  INTEGER REFERENCES users(id),
       created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS orders (
       id             INTEGER PRIMARY KEY AUTOINCREMENT,
       client_id      INTEGER REFERENCES clients(id),
       seller_id      INTEGER REFERENCES users(id),
       visit_id       INTEGER REFERENCES visits(id),
       status         TEXT DEFAULT 'pendente',
       payment_terms  TEXT,
       delivery_date  TEXT,
       notes          TEXT,
       total_value    REAL DEFAULT 0,
       payment_status TEXT DEFAULT 'pendente',
       invoice_number TEXT,
       erp_order_id   TEXT,
       created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS order_items (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       order_id    INTEGER REFERENCES orders(id),
       sku_id      INTEGER REFERENCES skus(id),
       quantity    INTEGER NOT NULL,
       unit_price  REAL DEFAULT 0,
       total_price REAL DEFAULT 0
     )`,
    `CREATE TABLE IF NOT EXISTS production_orders (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       order_id    INTEGER UNIQUE REFERENCES orders(id),
       status      TEXT DEFAULT 'pendente',
       priority    INTEGER DEFAULT 0,
       operator_id INTEGER REFERENCES users(id),
       start_time  DATETIME,
       end_time    DATETIME,
       notes       TEXT,
       created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS vehicles (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       plate      TEXT UNIQUE NOT NULL,
       model      TEXT,
       year       INTEGER,
       active     INTEGER DEFAULT 1,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS routes (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       name        TEXT NOT NULL,
       description TEXT,
       driver_id   INTEGER REFERENCES users(id),
       route_date  TEXT,
       status      TEXT DEFAULT 'planejada',
       created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS deliveries (
       id                 INTEGER PRIMARY KEY AUTOINCREMENT,
       order_id           INTEGER REFERENCES orders(id),
       driver_id          INTEGER REFERENCES users(id),
       vehicle_id         INTEGER REFERENCES vehicles(id),
       route_id           INTEGER REFERENCES routes(id),
       status             TEXT DEFAULT 'pendente',
       departure_time     DATETIME,
       arrival_time       DATETIME,
       completion_time    DATETIME,
       observations       TEXT,
       occurrence         TEXT,
       no_delivery_reason TEXT,
       canhoto_photo      TEXT,
       delivery_photo     TEXT,
       tubes_collected    INTEGER DEFAULT 0,
       tubes_quantity     INTEGER DEFAULT 0,
       tubes_had          INTEGER DEFAULT 0,
       tubes_pending      INTEGER DEFAULT 0,
       tubes_pending_qty  INTEGER DEFAULT 0,
       tubes_obs          TEXT,
       no_proof_reason    TEXT,
       created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS canhoto_photos (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       delivery_id INTEGER NOT NULL REFERENCES deliveries(id),
       filename    TEXT NOT NULL,
       uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id    INTEGER REFERENCES users(id),
       action     TEXT NOT NULL,
       table_name TEXT,
       record_id  INTEGER,
       details    TEXT,
       ip_address TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS integrations (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       name       TEXT UNIQUE NOT NULL,
       label      TEXT,
       endpoint   TEXT,
       api_key    TEXT,
       active     INTEGER DEFAULT 0,
       config     TEXT DEFAULT '{}',
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS notifications_queue (
       id           INTEGER PRIMARY KEY AUTOINCREMENT,
       type         TEXT NOT NULL,
       integration  TEXT,
       recipient    TEXT NOT NULL,
       subject      TEXT,
       message      TEXT NOT NULL,
       payload      TEXT DEFAULT '{}',
       status       TEXT DEFAULT 'pending',
       retry_count  INTEGER DEFAULT 0,
       scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       sent_at      DATETIME,
       error_msg    TEXT,
       created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    // Índices
    `CREATE INDEX IF NOT EXISTS idx_visits_seller  ON visits(seller_id, visit_date)`,
    `CREATE INDEX IF NOT EXISTS idx_visits_client  ON visits(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_client  ON orders(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_seller  ON orders(seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_deliveries_drv ON deliveries(driver_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_stock_mov_sku  ON stock_movements(sku_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_logs(user_id, created_at)`,
  ];

  _db.run('BEGIN');
  for (const stmt of stmts) _db.run(stmt);
  _db.run('COMMIT');

  // Seed de integrações
  const hasInteg = Number(_db.exec('SELECT COUNT(*) FROM integrations')[0]?.values[0]?.[0] ?? 0);
  if (hasInteg === 0) {
    _db.run("INSERT INTO integrations (name,label,active,config) VALUES (?,?,0,?)",
      ['whatsapp', 'WhatsApp Business API',
       JSON.stringify({ provider: 'evolution_api', base_url: '', instance: '', token: '' })]);
    _db.run("INSERT INTO integrations (name,label,active,config) VALUES (?,?,0,?)",
      ['financial', 'Modulo Financeiro',
       JSON.stringify({ provider: 'internal', auto_invoice: false })]);
    _db.run("INSERT INTO integrations (name,label,active,config) VALUES (?,?,0,?)",
      ['erp', 'Integracao ERP',
       JSON.stringify({ provider: '', webhook_url: '', api_key: '' })]);
  }
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

function _seedData() {
  const userCount = Number(_db.exec('SELECT COUNT(*) FROM users')[0]?.values[0]?.[0] ?? 0);
  if (userCount > 0) return;

  console.log('[Pack61] Inserindo dados de demonstracao...');
  const hash = (pw) => bcrypt.hashSync(pw, 10);
  const d    = (offset) => new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];
  const dt   = (offset) => new Date(Date.now() + offset * 86400000).toISOString().replace('T', ' ').split('.')[0];
  const in30 = () => d(30);

  _db.run('BEGIN');

  // Usuários
  function insUser(name, email, pw, role, phone) {
    _db.run('INSERT INTO users (name,email,password_hash,role,phone) VALUES (?,?,?,?,?)',
      [name, email, hash(pw), role, phone]);
    return Number(_db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  }
  const A  = insUser('Administrador',   'admin@pack61.com.br',    'admin123',    'admin',    '(11) 99000-0001');
  const C  = insUser('Carlos Mendes',   'carlos@pack61.com.br',   '123456',      'vendedor', '(11) 99111-1111');
  const AN = insUser('Ana Paula Silva', 'ana@pack61.com.br',       '123456',      'vendedor', '(11) 99222-2222');
  const J  = insUser('Joao Motorista',  'joao@pack61.com.br',      '123456',      'motorista','(11) 99333-3333');
  const MO = insUser('Marco Motorista', 'marco@pack61.com.br',     '123456',      'motorista','(11) 99444-4444');
  const PE = insUser('Pedro Producao',  'producao@pack61.com.br',  '123456',      'producao', '(11) 99555-5555');
  const FA = insUser('Fabio Estoque',   'fabio@pack61.com.br',     '123456',      'producao', '(11) 99666-6666');

  // SKUs
  function insSku(code, name, cat, type, weight, unit, minStock, cost) {
    _db.run('INSERT INTO skus (code,name,category,type,weight,unit,min_stock,unit_cost) VALUES (?,?,?,?,?,?,?,?)',
      [code, name, cat, type, weight, unit, minStock, cost]);
    return Number(_db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  }
  const skus = [
    insSku('FS-M-50-23', 'Filme Stretch Manual 50cm 23mic',  'Filme Stretch', 'manual',          1.5, 'RL', 50,  5.80),
    insSku('FS-M-50-20', 'Filme Stretch Manual 50cm 20mic',  'Filme Stretch', 'manual',          1.3, 'RL', 40,  5.20),
    insSku('FS-M-30-23', 'Filme Stretch Manual 30cm 23mic',  'Filme Stretch', 'manual',          0.9, 'RL', 30,  3.90),
    insSku('FS-A-50-17', 'Filme Stretch Auto 50cm 17mic',    'Filme Stretch', 'automatico',      2.5, 'RL', 40,  7.50),
    insSku('FS-A-75-17', 'Filme Stretch Auto 75cm 17mic',    'Filme Stretch', 'automatico',      3.8, 'RL', 20, 10.80),
    insSku('FS-A-100-17','Filme Stretch Auto 100cm 17mic',   'Filme Stretch', 'automatico',      5.0, 'RL', 15, 13.50),
    insSku('FS-ST-50-23','Filme Stretch Manual 50cm s/Tubo', 'Filme Stretch', 'manual_sem_tubo', 1.4, 'RL', 30,  5.60),
    insSku('FA-45-45',   'Fita Adesiva Parda 45mm x 45m',    'Fita Adesiva',  'fita_adesiva',    0.17,'RL',200,  1.20),
    insSku('FA-48-45',   'Fita Adesiva Parda 48mm x 45m',    'Fita Adesiva',  'fita_adesiva',    0.19,'RL',150,  1.35),
    insSku('FA-T-48-45', 'Fita Adesiva Transparente 48mm',   'Fita Adesiva',  'fita_adesiva',    0.18,'RL',100,  1.50),
  ];

  // Estoque inicial
  const initQty     = [280,190,150,120,75,40,95,680,520,320];
  const reservedQty = [ 30, 20, 15, 25,10, 5, 0, 80, 60, 30];
  for (let i = 0; i < skus.length; i++) {
    _db.run('INSERT INTO stock (sku_id,quantity_physical,quantity_reserved,quantity_available) VALUES (?,?,?,?)',
      [skus[i], initQty[i], reservedQty[i], initQty[i] - reservedQty[i]]);
  }

  // Clientes
  function insClient(name, company, cnpj, addr, city, region, phone, wa, seg, resp, sellerId) {
    _db.run('INSERT INTO clients (name,company_name,cnpj,address,city,region,state,phone,whatsapp,segment,responsible,seller_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [name, company, cnpj, addr, city, region, 'SP', phone, wa, seg, resp, sellerId]);
    return Number(_db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  }
  const clients = [
    insClient('Embalagens Rapidas Ltda',  'Embalagens Rapidas Ltda',  '12.345.678/0001-90','Rua Industrial, 100',   'Sao Paulo',   'Grande SP',   '(11) 3333-1111','(11) 98111-1111','Distribuidor',   'Roberto Silva',   C),
    insClient('Logistica Total S.A.',     'Logistica Total S.A.',     '98.765.432/0001-10','Av. Comercial, 500',    'Guarulhos',   'Grande SP',   '(11) 3444-2222','(11) 98222-2222','Transportadora', 'Fernanda Costa',  C),
    insClient('Supermercado BomPreco',    'BomPreco Comercio Ltda',   '11.222.333/0001-44','Rua do Comercio, 300',  'Campinas',    'Interior SP', '(19) 3555-3333','(19) 97333-3333','Varejo',         'Marcos Lima',     AN),
    insClient('Industria Metalica ABC',   'ABC Industria Ltda',       '55.666.777/0001-88','Parque Industrial, 50', 'Santo Andre', 'Grande SP',   '(11) 3666-4444','(11) 98444-4444','Industria',      'Patricia Santos', AN),
    insClient('Frigorifico Nortao',       'Nortao Alimentos S.A.',    '33.444.555/0001-22','BR-116, Km 45',         'Mogi Mirim',  'Interior SP', '(19) 3777-5555','(19) 97555-5555','Frigorifico',    'Alexandre Mota',  C),
    insClient('Distribuidora Sul Facil',  'Sul Facil Dist. Ltda',     '77.888.999/0001-66','Av. Brasil, 1200',      'Santos',      'Litoral SP',  '(13) 3888-6666','(13) 96666-6666','Distribuidor',   'Renata Oliveira', AN),
    insClient('Plasticos ModerPack',      'ModerPack Ind. Ltda',      '44.555.666/0001-33','Rua das Fabricas, 80',  'Sorocaba',    'Interior SP', '(15) 3999-7777','(15) 95777-7777','Industria',      'Claudio Pereira', C),
    insClient('Deposito Central Leste',   'DCL Comercio e Armazens',  '66.777.888/0001-55','Rua Estoque, 200',      'Osasco',      'Grande SP',   '(11) 3000-8888','(11) 94888-8888','Armazem',        'Silvana Rocha',   AN),
  ];

  // Visitas
  function insVisit(cId, sId, date, took, reason, nextDate, comp, compPrice, bob, tube, vol, prod, obs) {
    _db.run('INSERT INTO visits (client_id,seller_id,visit_date,took_order,no_order_reason,next_purchase_date,competitor,competitor_price,bobine_type,tube_type,monthly_volume,products_interest,observations) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [cId, sId, date, took ? 1 : 0, reason, nextDate, comp, compPrice, bob, tube, vol, prod, obs]);
    return Number(_db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  }
  const visits = [
    insVisit(clients[0],C,  d(0),  true, null,                         d(7),  null,       null, 'manual',    'com_tubo', 500,'FS-M-50-23, FA-45-45','Cliente fiel, compra mensal.'),
    insVisit(clients[1],C,  d(-1), false,'Preco alto',                  d(15), 'FilmePro', 8.50,'automatica','com_tubo', 800,'FS-A-50-17',          'Concorrente cobrando R$8,50/rl.'),
    insVisit(clients[2],AN, d(0),  true, null,                         d(10), null,       null, 'manual',    'sem_tubo', 200,'FS-ST-50-23, FA-48-45','Nova cliente, bom potencial.'),
    insVisit(clients[3],AN, d(-1), false,'Usando concorrente',          d(20), 'StretchBR',9.00,'automatica','com_tubo',1200,'FS-A-75-17',           'Abertura para teste de qualidade.'),
    insVisit(clients[4],C,  d(-2), true, null,                         d(5),  null,       null, 'automatica','com_tubo', 600,'FS-A-50-17, FS-A-75-17','Alto volume. Muito satisfeito.'),
    insVisit(clients[5],AN, d(-2), false,'Sem necessidade no momento',  in30(),null,       null, 'manual',    'com_tubo', 150,'FS-M-30-23',          'Stock alto. Retornar em 30 dias.'),
    insVisit(clients[6],C,  d(-5), true, null,                         d(10), null,       null, 'manual',    'com_tubo', 350,'FS-M-50-20, FA-48-45', 'Interesse em volume maior.'),
    insVisit(clients[7],AN, d(-5), true, null,                         d(15), null,       null, 'manual',    'sem_tubo', 250,'FS-ST-50-23',          'Pedido mensal fixo.'),
    insVisit(clients[0],C,  d(-10),true, null,                         null,  null,       null, 'manual',    'com_tubo', 500,'FS-M-50-23',           'Reposicao mensal normal.'),
    insVisit(clients[4],C,  d(-15),true, null,                         null,  null,       null, 'automatica','com_tubo', 600,'FS-A-50-17',           'Visita de rotina.'),
  ];

  // Pedidos
  function makeOrder(cId, sId, vId, status, terms, delivDate, notes, payStatus, items) {
    const total = items.reduce((a, [,qty,price]) => a + qty * price, 0);
    _db.run('INSERT INTO orders (client_id,seller_id,visit_id,status,payment_terms,delivery_date,notes,total_value,payment_status) VALUES (?,?,?,?,?,?,?,?,?)',
      [cId, sId, vId, status, terms, delivDate, notes, total, payStatus]);
    const orderId = Number(_db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
    for (const [skuIdx, qty, price] of items) {
      _db.run('INSERT INTO order_items (order_id,sku_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?)',
        [orderId, skus[skuIdx], qty, price, qty * price]);
    }
    return orderId;
  }

  const o1 = makeOrder(clients[0],C, visits[0],'pendente',       '30 dias', d(7),  'Urgente - prazo 7 dias', 'pendente', [[0,200,8.50],[7,100,1.80]]);
  const o2 = makeOrder(clients[2],AN,visits[2],'pendente',       '28 dias', d(5),  'Primeiro pedido. Testar qualidade.','pendente',[[6,80,8.20],[8,60,1.95]]);
  const o3 = makeOrder(clients[4],C, visits[4],'em_producao',    '30 dias', d(3),  '', 'pendente', [[3,150,10.50],[4,50,14.80]]);
  const o4 = makeOrder(clients[6],C, visits[6],'pronto_expedicao','28 dias', d(0), '', 'pendente', [[1,100,8.00],[8,80,1.90]]);
  const o5 = makeOrder(clients[7],AN,visits[7],'entregue',       'A vista', d(-1), '', 'pago',     [[6,60,8.20]]);
  const o6 = makeOrder(clients[0],C, visits[8],'entregue',       '30 dias', d(-5), '', 'faturado', [[0,300,8.40]]);
  const o7 = makeOrder(clients[4],C, visits[9],'entregue',       '30 dias', d(-10),'', 'pago',     [[3,200,10.20]]);
  const o8 = makeOrder(clients[1],C, visits[1],'cancelado',      '30 dias', null,  'Cliente cancelou por preco.','cancelado',[[3,100,10.50]]);

  // Ordens de produção
  function insProd(orderId, status, opId, startTime, endTime, priority) {
    _db.run('INSERT INTO production_orders (order_id,status,operator_id,start_time,end_time,priority) VALUES (?,?,?,?,?,?)',
      [orderId, status, opId, startTime, endTime, priority]);
  }
  insProd(o1,'pendente',        null, null,   null,   2);
  insProd(o2,'pendente',        null, null,   null,   1);
  insProd(o3,'em_producao',     PE,   dt(-1), null,   0);
  insProd(o4,'pronto_expedicao',PE,   dt(-3), dt(-1), 0);
  insProd(o5,'pronto_expedicao',PE,   dt(-7), dt(-6), 0);
  insProd(o6,'pronto_expedicao',PE,   dt(-12),dt(-11),0);
  insProd(o7,'pronto_expedicao',PE,   dt(-17),dt(-16),0);

  // Veículos
  function insVeh(plate, model, year) {
    _db.run('INSERT INTO vehicles (plate,model,year) VALUES (?,?,?)', [plate, model, year]);
    return Number(_db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  }
  const v1 = insVeh('ABC-1D23','VW Delivery 9.170', 2021);
  const v2 = insVeh('XYZ-2E45','Ford Cargo 816',    2020);
  const v3 = insVeh('DEF-3F67','Iveco Daily 35s14', 2022);

  // Rotas
  function insRoute(name, driverId, date, status) {
    _db.run('INSERT INTO routes (name,driver_id,route_date,status) VALUES (?,?,?,?)', [name, driverId, date, status]);
    return Number(_db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
  }
  const r1 = insRoute('Rota Grande SP — ' + d(0),    J,  d(0), 'ativa');
  const r2 = insRoute('Rota Interior SP — ' + d(0),  MO, d(0), 'ativa');

  // Entregas
  function insDel(orderId, driverId, vehId, routeId, status, dep, arr, comp, canhoto, tubesC, tubesQ, obs) {
    _db.run('INSERT INTO deliveries (order_id,driver_id,vehicle_id,route_id,status,departure_time,arrival_time,completion_time,canhoto_photo,tubes_collected,tubes_quantity,observations) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [orderId, driverId, vehId, routeId, status, dep, arr, comp, canhoto, tubesC, tubesQ, obs]);
  }
  //         orderId  driverId  vehId  routeId  status           dep      arr      comp     canhoto              tubesC tubesQ obs
  insDel(o4, J,       v1,       r1,    'pendente', null,           null,    null,    null,                        0,     0,     null);
  insDel(o5, MO,      v2,       r2,    'entregue', dt(-1),         dt(-1),  dt(-1),  'canhoto_demo.jpg',          1,     12,    'Entrega sem problemas. 12 tubos recolhidos.');
  insDel(o6, J,       v1,       null,  'entregue', dt(-5),         dt(-5),  dt(-5),  'canhoto_demo2.jpg',         0,     0,     null);
  insDel(o7, MO,      v2,       null,  'entregue', dt(-10),        dt(-10), dt(-10), 'canhoto_demo3.jpg',         1,     24,    'Recolha de tubos confirmada.');

  // Movimentações de estoque
  function insMov(skuIdx, type, qty, reason, refId, opId, dateStr) {
    _db.run('INSERT INTO stock_movements (sku_id,type,quantity,reason,reference_id,operator_id,created_at) VALUES (?,?,?,?,?,?,?)',
      [skus[skuIdx], type, qty, reason, refId, opId, dateStr]);
  }
  insMov(0,'entrada',  500,'Lote de producao #001', null,null, dt(-20));
  insMov(3,'entrada',  300,'Lote de producao #002', null,null, dt(-18));
  insMov(7,'entrada', 1000,'Lote de producao #003', null,null, dt(-15));
  insMov(8,'entrada',  800,'Lote de producao #004', null,null, dt(-12));
  insMov(4,'entrada',  150,'Lote de producao #005', null,null, dt(-10));
  insMov(0,'saida',    300,'Pedido entregue #'+o6,  o6,  PE,   dt(-5));
  insMov(3,'saida',    200,'Pedido entregue #'+o7,  o7,  PE,   dt(-10));
  insMov(6,'saida',     60,'Pedido entregue #'+o5,  o5,  PE,   dt(-1));
  insMov(0,'reserva',  200,'Reserva pedido #'+o1,   o1,  PE,   dt(0));
  insMov(7,'reserva',  100,'Reserva pedido #'+o1,   o1,  PE,   dt(0));
  insMov(6,'reserva',   80,'Reserva pedido #'+o2,   o2,  PE,   dt(0));
  insMov(8,'reserva',   60,'Reserva pedido #'+o2,   o2,  PE,   dt(0));
  insMov(9,'ajuste',   320,'Inventario mensal',      null,FA,   dt(-7));
  insMov(1,'perda',     10,'Rolos danificados',      null,PE,   dt(-3));

  // Audit logs iniciais
  _db.run('INSERT INTO audit_logs (user_id,action,table_name,created_at) VALUES (?,?,?,?)',
    [A, 'Sistema inicializado com dados de demonstracao', 'system', dt(-20)]);

  _db.run('COMMIT');
  console.log('[Pack61] Seed completo: 7 usuarios, 8 clientes, 10 SKUs, 10 visitas, 8 pedidos.');
}

// ─── Init Assíncrono ──────────────────────────────────────────────────────────

async function initDatabase() {
  const initSqlJs = require('sql.js');

  _SQL = await initSqlJs();

  // Carregar DB do disco se existir
  const fileBuffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  _db = fileBuffer ? new _SQL.Database(fileBuffer) : new _SQL.Database();

  // FK desativado durante criação do schema e seed para evitar
  // erros de ordem de inserção; reativado depois
  _db.run('PRAGMA foreign_keys = OFF');

  _createSchema();
  _seedData();

  // Habilitar foreign keys para uso em runtime
  _db.run('PRAGMA foreign_keys = ON');

  _flush(); // salvar estado inicial no disco

  console.log('[Pack61] Banco de dados inicializado:', DB_PATH);
}

module.exports = { initDatabase, getDb, auditLog };
