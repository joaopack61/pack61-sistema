const express = require('express');
const { getDb, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Reserva estoque quando pedido é criado; libera quando cancelado
function adjustStockReservation(db, orderId, action) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId);
  const movType = action === 'reserve' ? 'reserva' : 'cancelamento_reserva';

  items.forEach(item => {
    const stock = db.prepare('SELECT * FROM stock WHERE sku_id=?').get(item.sku_id);
    if (!stock) return;

    let reserved = stock.quantity_reserved;
    let available = stock.quantity_available;

    if (action === 'reserve') {
      reserved += item.quantity;
      available -= item.quantity;
    } else {
      reserved = Math.max(0, reserved - item.quantity);
      available += item.quantity;
    }

    db.prepare('UPDATE stock SET quantity_reserved=?,quantity_available=?,updated_at=CURRENT_TIMESTAMP WHERE sku_id=?')
      .run(reserved, available, item.sku_id);

    db.prepare('INSERT INTO stock_movements (sku_id,type,quantity,reason,reference_id,operator_id) VALUES (?,?,?,?,?,?)')
      .run(item.sku_id, movType, item.quantity, `Pedido #${orderId}`, orderId, null);
  });
}

// Desconta estoque físico quando pedido é entregue
function consumeStock(db, orderId) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId);
  items.forEach(item => {
    const stock = db.prepare('SELECT * FROM stock WHERE sku_id=?').get(item.sku_id);
    if (!stock) return;
    const physical  = Math.max(0, stock.quantity_physical - item.quantity);
    const reserved  = Math.max(0, stock.quantity_reserved - item.quantity);
    const available = Math.max(0, stock.quantity_available);
    db.prepare('UPDATE stock SET quantity_physical=?,quantity_reserved=?,quantity_available=?,updated_at=CURRENT_TIMESTAMP WHERE sku_id=?')
      .run(physical, reserved, available, item.sku_id);
    db.prepare('INSERT INTO stock_movements (sku_id,type,quantity,reason,reference_id,operator_id) VALUES (?,?,?,?,?,?)')
      .run(item.sku_id, 'saida', item.quantity, `Pedido entregue #${orderId}`, orderId, null);
  });
}

// ─── GET /orders ──────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const db = getDb();
  let q = `
    SELECT o.*,
      c.name as client_name, c.city, c.phone, c.whatsapp,
      u.name as seller_name
    FROM orders o
    LEFT JOIN clients c ON o.client_id=c.id
    LEFT JOIN users u   ON o.seller_id=u.id
    WHERE 1=1`;
  const p = [];

  if (req.user.role === 'vendedor') { q += ' AND o.seller_id=?'; p.push(req.user.id); }
  if (req.query.status)    { q += ' AND o.status=?';              p.push(req.query.status); }
  if (req.query.seller_id) { q += ' AND o.seller_id=?';           p.push(req.query.seller_id); }
  if (req.query.client_id) { q += ' AND o.client_id=?';           p.push(req.query.client_id); }
  if (req.query.date_from) { q += ' AND DATE(o.created_at)>=?';   p.push(req.query.date_from); }
  if (req.query.date_to)   { q += ' AND DATE(o.created_at)<=?';   p.push(req.query.date_to); }

  q += ' ORDER BY o.created_at DESC';
  const orders = db.prepare(q).all(...p);

  orders.forEach(o => {
    o.items = db.prepare(
      'SELECT oi.*, s.name as sku_name, s.code as sku_code, s.unit FROM order_items oi LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=?'
    ).all(o.id);
  });

  res.json(orders);
});

// ─── GET /orders/:id ─────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, c.name as client_name, c.address, c.city, c.phone, c.whatsapp,
      u.name as seller_name
    FROM orders o
    LEFT JOIN clients c ON o.client_id=c.id
    LEFT JOIN users u   ON o.seller_id=u.id
    WHERE o.id=?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  order.items = db.prepare(
    'SELECT oi.*, s.name as sku_name, s.code as sku_code, s.unit FROM order_items oi LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=?'
  ).all(order.id);
  res.json(order);
});

// ─── POST /orders ─────────────────────────────────────────────────────────────
router.post('/', authorize('admin', 'vendedor'), (req, res) => {
  const db = getDb();
  const { client_id, visit_id, payment_terms, delivery_date, notes, items } = req.body;
  if (!client_id || !items?.length) return res.status(400).json({ error: 'Cliente e itens são obrigatórios' });

  const seller_id = req.user.role === 'vendedor' ? req.user.id : (req.body.seller_id || req.user.id);
  const total = items.reduce((a, i) => a + (i.quantity * (i.unit_price || 0)), 0);

  const createOrder = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO orders (client_id,seller_id,visit_id,payment_terms,delivery_date,notes,total_value) VALUES (?,?,?,?,?,?,?)'
    ).run(client_id, seller_id, visit_id, payment_terms, delivery_date, notes, total);
    const orderId = result.lastInsertRowid;

    const insItem = db.prepare('INSERT INTO order_items (order_id,sku_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?)');
    items.forEach(i => insItem.run(orderId, i.sku_id, i.quantity, i.unit_price || 0, i.quantity * (i.unit_price || 0)));

    // Criar ordem de produção
    db.prepare("INSERT INTO production_orders (order_id,status) VALUES (?,'pendente')").run(orderId);

    // Reservar estoque
    adjustStockReservation(db, orderId, 'reserve');

    auditLog(req.user.id, 'order_created', 'orders', orderId, { client_id, total });
    return orderId;
  });

  const orderId = createOrder();
  res.status(201).json({ id: orderId });
});

// ─── PUT /orders/:id/status ───────────────────────────────────────────────────
router.put('/:id/status', authorize('admin', 'producao', 'motorista'), (req, res) => {
  const { status, notes } = req.body;
  const VALID = ['pendente','em_producao','produzido','pronto_expedicao','entregue','cancelado'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

  const update = db.transaction(() => {
    db.prepare('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, order.id);

    // Se cancelado → liberar reserva
    if (status === 'cancelado' && order.status !== 'cancelado') {
      adjustStockReservation(db, order.id, 'release');
    }
    // Se entregue → descontar estoque físico
    if (status === 'entregue' && order.status !== 'entregue') {
      consumeStock(db, order.id);
    }

    auditLog(req.user.id, 'order_status_changed', 'orders', order.id, {
      from: order.status, to: status
    });
  });

  update();
  res.json({ success: true });
});

// ─── PUT /orders/:id/payment ──────────────────────────────────────────────────
router.put('/:id/payment', authorize('admin'), (req, res) => {
  const { payment_status, invoice_number } = req.body;
  const VALID = ['pendente','faturado','pago','vencido','cancelado'];
  if (!VALID.includes(payment_status)) return res.status(400).json({ error: 'Status inválido' });

  getDb().prepare('UPDATE orders SET payment_status=?,invoice_number=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(payment_status, invoice_number, req.params.id);
  auditLog(req.user.id, 'payment_status_changed', 'orders', parseInt(req.params.id), { payment_status });
  res.json({ success: true });
});

module.exports = router;
