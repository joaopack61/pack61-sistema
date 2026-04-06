const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `delivery_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Rotas estaticas ANTES de /:id para evitar conflito
router.get('/vehicles/list', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM vehicles WHERE active=1 ORDER BY model').all());
});

router.get('/routes/list', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json(getDb().prepare(
    `SELECT r.*, u.name as driver_name FROM routes r LEFT JOIN users u ON r.driver_id=u.id WHERE r.route_date >= ? ORDER BY r.route_date DESC LIMIT 30`
  ).all(today));
});

router.post('/routes', authorize('admin'), (req, res) => {
  const { name, description, driver_id, route_date } = req.body;
  if (!name || !driver_id || !route_date) return res.status(400).json({ error: 'Nome, motorista e data obrigatorios' });
  const result = getDb().prepare('INSERT INTO routes (name, description, driver_id, route_date) VALUES (?,?,?,?)').run(name, description, driver_id, route_date);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.get('/', (req, res) => {
  const db = getDb();
  let q = `SELECT d.*, o.total_value, c.name as client_name, c.address, c.city, c.phone,
    u.name as driver_name, v.plate, v.model, r.name as route_name
    FROM deliveries d
    LEFT JOIN orders o ON d.order_id=o.id
    LEFT JOIN clients c ON o.client_id=c.id
    LEFT JOIN users u ON d.driver_id=u.id
    LEFT JOIN vehicles v ON d.vehicle_id=v.id
    LEFT JOIN routes r ON d.route_id=r.id
    WHERE 1=1`;
  const p = [];
  if (req.user.role === 'motorista') { q += ' AND d.driver_id=?'; p.push(req.user.id); }
  if (req.query.driver_id && req.user.role === 'admin') { q += ' AND d.driver_id=?'; p.push(req.query.driver_id); }
  if (req.query.status) { q += ' AND d.status=?'; p.push(req.query.status); }
  if (req.query.date_from) { q += ' AND DATE(d.created_at)>=?'; p.push(req.query.date_from); }
  if (req.query.date_to) { q += ' AND DATE(d.created_at)<=?'; p.push(req.query.date_to); }
  q += ' ORDER BY d.created_at DESC';
  const deliveries = db.prepare(q).all(...p);
  deliveries.forEach(d => {
    d.items = db.prepare(`SELECT oi.*, s.name as sku_name, s.unit FROM order_items oi LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=?`).all(d.order_id);
  });
  res.json(deliveries);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const d = db.prepare(
    `SELECT d.*,o.total_value,c.name as client_name,c.address,c.city,c.phone,u.name as driver_name,v.plate,v.model
    FROM deliveries d
    LEFT JOIN orders o ON d.order_id=o.id
    LEFT JOIN clients c ON o.client_id=c.id
    LEFT JOIN users u ON d.driver_id=u.id
    LEFT JOIN vehicles v ON d.vehicle_id=v.id
    WHERE d.id=?`
  ).get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Entrega nao encontrada' });
  if (req.user.role === 'motorista' && d.driver_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
  d.items = db.prepare(`SELECT oi.*, s.name as sku_name, s.unit FROM order_items oi LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=?`).all(d.order_id);
  res.json(d);
});

router.post('/', authorize('admin'), (req, res) => {
  const { order_id, driver_id, vehicle_id, route_id } = req.body;
  if (!order_id || !driver_id) return res.status(400).json({ error: 'Pedido e motorista obrigatorios' });

  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(order_id);
  if (!order) return res.status(404).json({ error: 'Pedido nao encontrado' });
  if (!['pronto_expedicao', 'produzido'].includes(order.status)) {
    return res.status(400).json({ error: 'Pedido precisa estar pronto para expedicao' });
  }

  const driver = db.prepare('SELECT * FROM users WHERE id=? AND role=? AND active=1').get(driver_id, 'motorista');
  if (!driver) return res.status(400).json({ error: 'Motorista invalido' });

  const existing = db.prepare("SELECT id FROM deliveries WHERE order_id=? AND status NOT IN ('nao_entregue')").get(order_id);
  if (existing) return res.status(400).json({ error: 'Pedido ja tem entrega em andamento' });

  const result = db.prepare('INSERT INTO deliveries (order_id,driver_id,vehicle_id,route_id) VALUES (?,?,?,?)').run(order_id, driver_id, vehicle_id || null, route_id || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id/status', authorize('admin', 'motorista'), upload.fields([{ name: 'canhoto_photo' }, { name: 'delivery_photo' }]), (req, res) => {
  const { status, observations, occurrence, no_delivery_reason, tubes_collected, tubes_quantity } = req.body;

  const VALID_STATUS = ['pendente','saiu_entrega','chegou_cliente','entregue','ocorrencia','nao_entregue'];
  if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status invalido' });

  const db = getDb();
  const d = db.prepare('SELECT * FROM deliveries WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Entrega nao encontrada' });
  if (req.user.role === 'motorista' && d.driver_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

  const now = new Date().toISOString();
  let departure = d.departure_time;
  let arrival = d.arrival_time;
  let completion = d.completion_time;
  if (status === 'saiu_entrega' && !departure) departure = now;
  if (status === 'chegou_cliente' && !arrival) arrival = now;
  if (status === 'entregue' && !completion) completion = now;

  const canhoto = req.files?.canhoto_photo?.[0]?.filename || d.canhoto_photo;
  const dphoto = req.files?.delivery_photo?.[0]?.filename || d.delivery_photo;

  db.prepare(`UPDATE deliveries SET status=?,observations=?,occurrence=?,no_delivery_reason=?,tubes_collected=?,tubes_quantity=?,departure_time=?,arrival_time=?,completion_time=?,canhoto_photo=?,delivery_photo=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(
      status,
      observations || d.observations,
      occurrence || d.occurrence,
      no_delivery_reason || d.no_delivery_reason,
      tubes_collected !== undefined ? parseInt(tubes_collected) : d.tubes_collected,
      tubes_quantity ? parseInt(tubes_quantity) : d.tubes_quantity,
      departure, arrival, completion, canhoto, dphoto, req.params.id
    );

  if (status === 'entregue') {
    db.prepare('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run('entregue', d.order_id);
  }
  res.json({ success: true });
});

module.exports = router;
