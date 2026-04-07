'use strict';
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Pasta de uploads configurável via env (igual ao server.js)
const uploadsDir = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `del_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// ─── helpers ──────────────────────────────────────────────────────────────────
function getCanhotos(db, deliveryId) {
  const photos = db.prepare('SELECT * FROM canhoto_photos WHERE delivery_id=? ORDER BY uploaded_at ASC').all(deliveryId);
  // inclui também o campo legado canhoto_photo
  return photos;
}

// ─── Rotas estáticas ANTES de /:id ────────────────────────────────────────────
router.get('/vehicles/list', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM vehicles WHERE active=1 ORDER BY model').all());
});

router.get('/routes/list', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json(getDb().prepare(
    `SELECT r.*, u.name as driver_name FROM routes r LEFT JOIN users u ON r.driver_id=u.id WHERE r.route_date >= ? ORDER BY r.route_date DESC LIMIT 30`
  ).all(today));
});

// Relatório de tubos (admin)
router.get('/reports/tubes', authorize('admin'), (req, res) => {
  const db = getDb();
  const byDriver = db.prepare(`
    SELECT u.name as driver_name,
           COUNT(CASE WHEN d.tubes_had=1 THEN 1 END)     as routes_with_tubes,
           COALESCE(SUM(d.tubes_quantity),0)              as total_collected,
           COALESCE(SUM(d.tubes_pending_qty),0)           as total_pending,
           COUNT(CASE WHEN d.tubes_pending=1 THEN 1 END)  as deliveries_with_pending
    FROM deliveries d
    JOIN users u ON d.driver_id=u.id
    WHERE d.tubes_had=1
    GROUP BY d.driver_id ORDER BY total_collected DESC
  `).all();

  const byClient = db.prepare(`
    SELECT c.name as client_name, c.city,
           COALESCE(SUM(d.tubes_quantity),0)    as total_collected,
           COALESCE(SUM(d.tubes_pending_qty),0)  as total_pending,
           COUNT(CASE WHEN d.tubes_pending=1 THEN 1 END) as open_pending
    FROM deliveries d
    JOIN orders o ON d.order_id=o.id
    JOIN clients c ON o.client_id=c.id
    WHERE d.tubes_had=1
    GROUP BY o.client_id ORDER BY total_collected DESC
  `).all();

  const pendingOpen = db.prepare(`
    SELECT d.id, c.name as client_name, u.name as driver_name,
           d.tubes_pending_qty, d.tubes_obs, d.completion_time
    FROM deliveries d
    JOIN orders o ON d.order_id=o.id
    JOIN clients c ON o.client_id=c.id
    JOIN users u ON d.driver_id=u.id
    WHERE d.tubes_pending=1
    ORDER BY d.completion_time DESC LIMIT 50
  `).all();

  res.json({ by_driver: byDriver, by_client: byClient, pending_open: pendingOpen });
});

// Relatório de canhotos (admin)
router.get('/reports/canhotos', authorize('admin'), (req, res) => {
  const db = getDb();
  const { date_from, date_to, driver_id, has_canhoto } = req.query;
  let q = `
    SELECT d.id, d.status, d.completion_time, d.canhoto_photo, d.no_proof_reason,
           c.name as client_name, c.city,
           u.name as driver_name,
           (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=d.id) as photo_count
    FROM deliveries d
    LEFT JOIN orders o ON d.order_id=o.id
    LEFT JOIN clients c ON o.client_id=c.id
    LEFT JOIN users u ON d.driver_id=u.id
    WHERE 1=1
  `;
  const p = [];
  if (driver_id) { q += ' AND d.driver_id=?'; p.push(driver_id); }
  if (date_from) { q += ' AND DATE(d.updated_at)>=?'; p.push(date_from); }
  if (date_to)   { q += ' AND DATE(d.updated_at)<=?'; p.push(date_to); }
  if (has_canhoto === '1') {
    q += ' AND (d.canhoto_photo IS NOT NULL OR (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=d.id)>0)';
  } else if (has_canhoto === '0') {
    q += ' AND d.canhoto_photo IS NULL AND (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=d.id)=0';
  }
  q += ' ORDER BY d.updated_at DESC LIMIT 100';
  res.json(db.prepare(q).all(...p));
});

// ─── CRUD principal ────────────────────────────────────────────────────────────
router.post('/routes', authorize('admin'), (req, res) => {
  const { name, description, driver_id, route_date } = req.body;
  if (!name || !driver_id || !route_date) return res.status(400).json({ error: 'Nome, motorista e data obrigatorios' });
  const result = getDb().prepare('INSERT INTO routes (name, description, driver_id, route_date) VALUES (?,?,?,?)').run(name, description, driver_id, route_date);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.get('/', (req, res) => {
  const db = getDb();
  let q = `
    SELECT d.*,
           o.total_value, c.name as client_name, c.address, c.city, c.phone,
           u.name as driver_name, v.plate, v.model, r.name as route_name,
           (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=d.id) as canhoto_count
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
  if (req.query.date_to)   { q += ' AND DATE(d.created_at)<=?'; p.push(req.query.date_to); }
  q += ' ORDER BY d.created_at DESC';

  const deliveries = db.prepare(q).all(...p);
  deliveries.forEach(d => {
    d.items = db.prepare(`SELECT oi.*, s.name as sku_name, s.unit FROM order_items oi LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=?`).all(d.order_id);
  });
  res.json(deliveries);
});

router.get('/:id/photos', (req, res) => {
  const db = getDb();
  const d = db.prepare('SELECT id, driver_id FROM deliveries WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Entrega nao encontrada' });
  if (req.user.role === 'motorista' && d.driver_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
  res.json(db.prepare('SELECT * FROM canhoto_photos WHERE delivery_id=? ORDER BY uploaded_at ASC').all(req.params.id));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const d = db.prepare(
    `SELECT d.*,
            o.total_value, c.name as client_name, c.address, c.city, c.phone,
            u.name as driver_name, v.plate, v.model
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
  d.canhoto_photos = getCanhotos(db, d.id);
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

// Upload de status + tubos + múltiplos canhotos
router.put('/:id/status',
  authorize('admin', 'motorista'),
  upload.fields([
    { name: 'canhoto_photos', maxCount: 10 },
    { name: 'delivery_photo', maxCount: 1 },
  ]),
  (req, res) => {
    const {
      status, observations, occurrence, no_delivery_reason,
      tubes_collected, tubes_quantity,
      tubes_had, tubes_pending, tubes_pending_qty, tubes_obs,
      no_proof_reason,
    } = req.body;

    const VALID_STATUS = ['pendente','saiu_entrega','chegou_cliente','entregue','ocorrencia','nao_entregue'];
    if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status invalido' });

    const db = getDb();
    const d = db.prepare('SELECT * FROM deliveries WHERE id=?').get(req.params.id);
    if (!d) return res.status(404).json({ error: 'Entrega nao encontrada' });
    if (req.user.role === 'motorista' && d.driver_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

    // Novos canhotos enviados agora
    const newPhotos = req.files?.canhoto_photos || [];

    // Validação: entrega concluída exige comprovante OU justificativa
    if (status === 'entregue') {
      const hasLegacy   = !!d.canhoto_photo;
      const hasNewInDb  = db.prepare('SELECT COUNT(*) as c FROM canhoto_photos WHERE delivery_id=?').get(d.id).c > 0;
      const hasSending  = newPhotos.length > 0;
      const hasProof    = hasLegacy || hasNewInDb || hasSending;
      const justificativa = (no_proof_reason || '').trim();
      if (!hasProof && !justificativa) {
        return res.status(400).json({
          error: 'Comprovante obrigatorio',
          message: 'Anexe o canhoto assinado ou informe uma justificativa para concluir a entrega.',
        });
      }
    }

    const now = new Date().toISOString();
    const departure  = d.departure_time  || (status === 'saiu_entrega'   ? now : null);
    const arrival    = d.arrival_time    || (status === 'chegou_cliente'  ? now : null);
    const completion = d.completion_time || (status === 'entregue'        ? now : null);

    const dphoto = req.files?.delivery_photo?.[0]?.filename || d.delivery_photo;

    db.prepare(`
      UPDATE deliveries SET
        status=?, observations=?, occurrence=?, no_delivery_reason=?,
        tubes_collected=?, tubes_quantity=?,
        tubes_had=?, tubes_pending=?, tubes_pending_qty=?, tubes_obs=?,
        no_proof_reason=?,
        departure_time=?, arrival_time=?, completion_time=?,
        delivery_photo=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      status,
      observations   || d.observations,
      occurrence     || d.occurrence,
      no_delivery_reason || d.no_delivery_reason,
      tubes_collected !== undefined ? parseInt(tubes_collected) : d.tubes_collected,
      tubes_quantity  ? parseInt(tubes_quantity)  : d.tubes_quantity,
      tubes_had       !== undefined ? parseInt(tubes_had)       : d.tubes_had,
      tubes_pending   !== undefined ? parseInt(tubes_pending)   : d.tubes_pending,
      tubes_pending_qty ? parseInt(tubes_pending_qty) : d.tubes_pending_qty,
      tubes_obs       || d.tubes_obs,
      no_proof_reason !== undefined ? no_proof_reason : d.no_proof_reason,
      departure, arrival, completion,
      dphoto, req.params.id,
    );

    // Salva novos canhotos na tabela canhoto_photos
    for (const f of newPhotos) {
      db.prepare('INSERT INTO canhoto_photos (delivery_id, filename) VALUES (?,?)').run(d.id, f.filename);
    }

    if (status === 'entregue') {
      db.prepare('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run('entregue', d.order_id);
    }

    res.json({ success: true });
  }
);

module.exports = router;
