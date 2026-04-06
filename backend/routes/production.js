const express = require('express');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin', 'producao'));

router.get('/', (req, res) => {
  const db = getDb();
  let query = `SELECT po.*, o.total_value, o.delivery_date, o.notes as order_notes,
    c.name as client_name, c.city, u.name as seller_name, op.name as operator_name
    FROM production_orders po
    LEFT JOIN orders o ON po.order_id = o.id
    LEFT JOIN clients c ON o.client_id = c.id
    LEFT JOIN users u ON o.seller_id = u.id
    LEFT JOIN users op ON po.operator_id = op.id
    WHERE 1=1`;
  const params = [];
  if (req.query.status) { query += ' AND po.status = ?'; params.push(req.query.status); }
  query += ' ORDER BY po.created_at DESC';
  const prodOrders = db.prepare(query).all(...params);
  prodOrders.forEach(p => {
    p.items = db.prepare(`SELECT oi.*, s.name as sku_name, s.code FROM order_items oi LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=?`).all(p.order_id);
  });
  res.json(prodOrders);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const p = db.prepare(`SELECT po.*, o.total_value, o.delivery_date, c.name as client_name, u.name as seller_name, op.name as operator_name
    FROM production_orders po LEFT JOIN orders o ON po.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.seller_id=u.id LEFT JOIN users op ON po.operator_id=op.id
    WHERE po.id=?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Ordem nao encontrada' });
  p.items = db.prepare(`SELECT oi.*, s.name as sku_name, s.code FROM order_items oi LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=?`).all(p.order_id);
  res.json(p);
});

router.put('/:id/status', (req, res) => {
  const { status, notes } = req.body;
  const db = getDb();
  const p = db.prepare('SELECT * FROM production_orders WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Ordem nao encontrada' });

  const now = new Date().toISOString();
  let start = p.start_time;
  let end = p.end_time;

  if (status === 'em_producao' && !start) start = now;
  if ((status === 'produzido' || status === 'pronto_expedicao') && !end) end = now;

  db.prepare('UPDATE production_orders SET status=?,operator_id=?,start_time=?,end_time=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(status, req.user.id, start, end, notes || p.notes, req.params.id);
  db.prepare('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, p.order_id);

  res.json({ success: true });
});

module.exports = router;
