const express = require('express');
const { getDb, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin', 'producao'));

// ─── SKUs ─────────────────────────────────────────────────────────────────────

router.get('/skus', (req, res) => {
  const db = getDb();
  let q = `
    SELECT s.*, st.quantity_physical, st.quantity_reserved, st.quantity_available,
      CASE WHEN st.quantity_available <= s.min_stock THEN 1 ELSE 0 END as is_low_stock
    FROM skus s LEFT JOIN stock st ON s.id=st.sku_id
    WHERE s.active=1`;
  const p = [];
  if (req.query.category) { q += ' AND s.category=?'; p.push(req.query.category); }
  if (req.query.low_stock === '1') q += ' AND st.quantity_available <= s.min_stock';
  q += ' ORDER BY s.category, s.name';
  res.json(db.prepare(q).all(...p));
});

router.get('/skus/:id', (req, res) => {
  const sku = getDb().prepare(`
    SELECT s.*, st.quantity_physical, st.quantity_reserved, st.quantity_available
    FROM skus s LEFT JOIN stock st ON s.id=st.sku_id WHERE s.id=?
  `).get(req.params.id);
  if (!sku) return res.status(404).json({ error: 'SKU não encontrado' });
  res.json(sku);
});

router.post('/skus', (req, res) => {
  const { code, name, category, type, weight, unit, min_stock, observations } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Código e nome são obrigatórios' });
  const db = getDb();
  try {
    const result = db.prepare(
      'INSERT INTO skus (code,name,category,type,weight,unit,min_stock,observations) VALUES (?,?,?,?,?,?,?,?)'
    ).run(code, name, category, type, weight, unit || 'UN', min_stock || 0, observations);
    db.prepare('INSERT INTO stock (sku_id,quantity_physical,quantity_reserved,quantity_available) VALUES (?,0,0,0)')
      .run(result.lastInsertRowid);
    auditLog(req.user.id, 'sku_created', 'skus', result.lastInsertRowid, { code, name });
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Código já cadastrado' });
    throw e;
  }
});

router.put('/skus/:id', (req, res) => {
  const { name, category, type, weight, unit, min_stock, observations, active } = req.body;
  const db = getDb();
  db.prepare('UPDATE skus SET name=?,category=?,type=?,weight=?,unit=?,min_stock=?,observations=?,active=? WHERE id=?')
    .run(name, category, type, weight, unit, min_stock, observations, active !== false ? 1 : 0, req.params.id);
  auditLog(req.user.id, 'sku_updated', 'skus', parseInt(req.params.id), { name, min_stock });
  res.json({ success: true });
});

// ─── RESUMO DE ESTOQUE ────────────────────────────────────────────────────────

// Retorna totais agregados e lista de SKUs com status visual
router.get('/summary', (req, res) => {
  const db = getDb();
  const skus = db.prepare(`
    SELECT s.id, s.code, s.name, s.category, s.unit, s.min_stock,
      COALESCE(st.quantity_physical, 0) as physical,
      COALESCE(st.quantity_reserved, 0) as reserved,
      COALESCE(st.quantity_available, 0) as available,
      CASE
        WHEN COALESCE(st.quantity_available, 0) <= 0 THEN 'critico'
        WHEN COALESCE(st.quantity_available, 0) <= s.min_stock THEN 'baixo'
        ELSE 'ok'
      END as stock_status,
      CASE WHEN COALESCE(st.quantity_physical, 0) > 0
        THEN ROUND(COALESCE(st.quantity_reserved, 0) * 100.0 / COALESCE(st.quantity_physical, 0), 1)
        ELSE 0
      END as reserved_pct
    FROM skus s LEFT JOIN stock st ON s.id=st.sku_id
    WHERE s.active=1 ORDER BY s.category, s.name
  `).all();

  const totals = {
    total_physical: skus.reduce((a, s) => a + s.physical, 0),
    total_reserved: skus.reduce((a, s) => a + s.reserved, 0),
    total_available: skus.reduce((a, s) => a + s.available, 0),
    sku_count: skus.length,
    low_count: skus.filter(s => s.stock_status === 'baixo').length,
    critical_count: skus.filter(s => s.stock_status === 'critico').length,
  };

  res.json({ totals, skus });
});

// ─── RESERVAS POR PEDIDO PARA UM SKU ─────────────────────────────────────────

router.get('/reservations/:sku_id', (req, res) => {
  const reservations = getDb().prepare(`
    SELECT oi.quantity, o.id as order_id, o.status as order_status,
      o.delivery_date, c.name as client_name, u.name as seller_name
    FROM order_items oi
    JOIN orders o ON oi.order_id=o.id
    LEFT JOIN clients c ON o.client_id=c.id
    LEFT JOIN users u ON o.seller_id=u.id
    WHERE oi.sku_id=? AND o.status NOT IN ('entregue','cancelado')
    ORDER BY o.delivery_date ASC
  `).all(req.params.sku_id);
  res.json(reservations);
});

// ─── ALERTAS ─────────────────────────────────────────────────────────────────

router.get('/alerts', (req, res) => {
  const items = getDb().prepare(`
    SELECT s.id, s.code, s.name, s.category, s.unit, s.min_stock,
      COALESCE(st.quantity_physical, 0) as physical,
      COALESCE(st.quantity_reserved, 0) as reserved,
      COALESCE(st.quantity_available, 0) as available
    FROM skus s LEFT JOIN stock st ON s.id=st.sku_id
    WHERE s.active=1 AND COALESCE(st.quantity_available, 0) <= s.min_stock
    ORDER BY st.quantity_available ASC
  `).all();
  res.json(items);
});

// ─── MOVIMENTAÇÕES ────────────────────────────────────────────────────────────

router.get('/movements', (req, res) => {
  let q = `
    SELECT sm.*, s.name as sku_name, s.code, s.unit,
      u.name as operator_name
    FROM stock_movements sm
    LEFT JOIN skus s ON sm.sku_id=s.id
    LEFT JOIN users u ON sm.operator_id=u.id
    WHERE 1=1`;
  const p = [];
  if (req.query.sku_id)   { q += ' AND sm.sku_id=?';             p.push(req.query.sku_id); }
  if (req.query.type)     { q += ' AND sm.type=?';                p.push(req.query.type); }
  if (req.query.date_from){ q += ' AND DATE(sm.created_at)>=?';  p.push(req.query.date_from); }
  if (req.query.date_to)  { q += ' AND DATE(sm.created_at)<=?';  p.push(req.query.date_to); }
  q += ' ORDER BY sm.created_at DESC LIMIT 300';
  res.json(getDb().prepare(q).all(...p));
});

router.post('/movements', (req, res) => {
  const { sku_id, type, quantity, reason } = req.body;
  const VALID_TYPES = ['entrada', 'saida', 'ajuste', 'perda', 'avaria', 'producao'];
  if (!sku_id || !type || !quantity) return res.status(400).json({ error: 'SKU, tipo e quantidade são obrigatórios' });
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo de movimentação inválido' });

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Quantidade deve ser positiva' });

  const db = getDb();
  const stock = db.prepare('SELECT * FROM stock WHERE sku_id=?').get(sku_id);
  if (!stock) return res.status(404).json({ error: 'Estoque não encontrado para este SKU' });

  const doMovement = db.transaction(() => {
    db.prepare('INSERT INTO stock_movements (sku_id,type,quantity,reason,operator_id) VALUES (?,?,?,?,?)')
      .run(sku_id, type, qty, reason, req.user.id);

    let physical = stock.quantity_physical;
    if (['entrada', 'producao'].includes(type)) physical += qty;
    else if (['saida', 'perda', 'avaria'].includes(type)) physical -= qty;
    else if (type === 'ajuste') physical = qty;

    physical = Math.max(0, physical);
    const available = Math.max(0, physical - (stock.quantity_reserved || 0));

    db.prepare('UPDATE stock SET quantity_physical=?,quantity_available=?,updated_at=CURRENT_TIMESTAMP WHERE sku_id=?')
      .run(physical, available, sku_id);

    auditLog(req.user.id, 'stock_movement', 'stock_movements', null, { sku_id, type, quantity: qty, reason });
  });

  doMovement();
  res.status(201).json({ success: true });
});

// ─── INVENTÁRIO (ajuste em lote) ─────────────────────────────────────────────

router.post('/inventory', (req, res) => {
  const { items, notes } = req.body; // items: [{ sku_id, quantity }]
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Lista de itens obrigatória' });

  const db = getDb();
  const doInventory = db.transaction(() => {
    items.forEach(({ sku_id, quantity }) => {
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty < 0) return;
      const stock = db.prepare('SELECT * FROM stock WHERE sku_id=?').get(sku_id);
      if (!stock) return;

      db.prepare('INSERT INTO stock_movements (sku_id,type,quantity,reason,operator_id) VALUES (?,?,?,?,?)')
        .run(sku_id, 'ajuste', qty, notes || 'Inventário manual', req.user.id);

      const available = Math.max(0, qty - (stock.quantity_reserved || 0));
      db.prepare('UPDATE stock SET quantity_physical=?,quantity_available=?,updated_at=CURRENT_TIMESTAMP WHERE sku_id=?')
        .run(qty, available, sku_id);
    });
    auditLog(req.user.id, 'inventory_done', 'stock', null, { count: items.length, notes });
  });

  doInventory();
  res.json({ success: true });
});

module.exports = router;
