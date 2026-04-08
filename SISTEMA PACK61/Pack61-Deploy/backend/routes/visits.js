const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => cb(null, `visit_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const db = getDb();
  let query = `SELECT v.*, c.name as client_name, c.city, u.name as seller_name
    FROM visits v
    LEFT JOIN clients c ON v.client_id = c.id
    LEFT JOIN users u ON v.seller_id = u.id
    WHERE 1=1`;
  const params = [];

  if (req.user.role === 'vendedor') { query += ' AND v.seller_id = ?'; params.push(req.user.id); }
  if (req.query.seller_id && req.user.role === 'admin') { query += ' AND v.seller_id = ?'; params.push(req.query.seller_id); }
  if (req.query.client_id) { query += ' AND v.client_id = ?'; params.push(req.query.client_id); }
  if (req.query.date_from) { query += ' AND v.visit_date >= ?'; params.push(req.query.date_from); }
  if (req.query.date_to) { query += ' AND v.visit_date <= ?'; params.push(req.query.date_to); }
  if (req.query.took_order !== undefined) { query += ' AND v.took_order = ?'; params.push(req.query.took_order); }

  query += ' ORDER BY v.visit_date DESC, v.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const visit = getDb().prepare(`
    SELECT v.*, c.name as client_name, u.name as seller_name
    FROM visits v LEFT JOIN clients c ON v.client_id=c.id LEFT JOIN users u ON v.seller_id=u.id
    WHERE v.id=?`).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visita nao encontrada' });
  if (req.user.role === 'vendedor' && visit.seller_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
  res.json(visit);
});

router.post('/', authorize('admin', 'vendedor'), upload.single('photo'), (req, res) => {
  const { client_id, visit_date, took_order, no_order_reason, next_purchase_date, competitor, competitor_price, bobine_type, tube_type, monthly_volume, products_interest, observations, lat, lng } = req.body;
  if (!client_id || !visit_date) return res.status(400).json({ error: 'Cliente e data sao obrigatorios' });

  const seller_id = req.user.role === 'vendedor' ? req.user.id : (req.body.seller_id || req.user.id);
  const photo = req.file ? req.file.filename : null;

  const result = getDb().prepare(`INSERT INTO visits (client_id,seller_id,visit_date,took_order,no_order_reason,next_purchase_date,competitor,competitor_price,bobine_type,tube_type,monthly_volume,products_interest,observations,lat,lng,photo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(client_id, seller_id, visit_date, took_order ? 1 : 0, no_order_reason, next_purchase_date, competitor, competitor_price, bobine_type, tube_type, monthly_volume, products_interest, observations, lat, lng, photo);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', authorize('admin', 'vendedor'), (req, res) => {
  const db = getDb();
  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visita nao encontrada' });
  if (req.user.role === 'vendedor' && visit.seller_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
  const { observations, next_purchase_date, competitor, competitor_price } = req.body;
  db.prepare('UPDATE visits SET observations=?,next_purchase_date=?,competitor=?,competitor_price=? WHERE id=?')
    .run(observations, next_purchase_date, competitor, competitor_price, req.params.id);
  res.json({ success: true });
});

module.exports = router;
