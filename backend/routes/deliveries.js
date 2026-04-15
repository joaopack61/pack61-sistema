'use strict';
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { query, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const uploadsDir = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `del_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ─── Rotas estáticas ANTES de /:id ────────────────────────────────────────────

router.get('/vehicles/list', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicles WHERE active=true ORDER BY model');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

router.get('/routes/list', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await query(
      `SELECT r.*, u.name as driver_name FROM routes r LEFT JOIN users u ON r.driver_id=u.id WHERE r.route_date >= $1 ORDER BY r.route_date DESC LIMIT 30`,
      [today]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// Relatório de tubos (admin)
router.get('/reports/tubes', authorize('admin'), async (req, res) => {
  try {
    const byDriver = await query(`
      SELECT u.name as driver_name,
             COUNT(CASE WHEN d.tubes_had=true THEN 1 END)    as routes_with_tubes,
             COALESCE(SUM(d.tubes_quantity),0)               as total_collected,
             COALESCE(SUM(d.tubes_pending_qty),0)            as total_pending,
             COUNT(CASE WHEN d.tubes_pending=true THEN 1 END) as deliveries_with_pending,
             COALESCE(SUM(d.tubes_p5),0)                     as total_p5,
             COALESCE(SUM(d.tubes_p10),0)                    as total_p10,
             COALESCE(SUM(d.tubes_p5)*0.50 + SUM(d.tubes_p10)*1.00, 0) as total_value
      FROM deliveries d
      JOIN users u ON d.driver_id=u.id
      WHERE d.tubes_had=true
      GROUP BY d.driver_id, u.name ORDER BY total_collected DESC
    `);

    const byClient = await query(`
      SELECT c.name as client_name, c.city, c.cidade,
             COALESCE(SUM(d.tubes_quantity),0)   as total_collected,
             COALESCE(SUM(d.tubes_pending_qty),0) as total_pending,
             COUNT(CASE WHEN d.tubes_pending=true THEN 1 END) as open_pending,
             COALESCE(SUM(d.tubes_p5),0)          as total_p5,
             COALESCE(SUM(d.tubes_p10),0)         as total_p10,
             COALESCE(SUM(d.tubes_p5)*0.50 + SUM(d.tubes_p10)*1.00, 0) as total_value
      FROM deliveries d
      JOIN orders o ON d.order_id=o.id
      JOIN clients c ON o.client_id=c.id
      WHERE d.tubes_had=true
      GROUP BY o.client_id, c.name, c.city, c.cidade ORDER BY total_collected DESC
    `);

    const pendingOpen = await query(`
      SELECT d.id, c.name as client_name, u.name as driver_name,
             d.tubes_pending_qty, d.tubes_obs, d.completion_time
      FROM deliveries d
      JOIN orders o ON d.order_id=o.id
      JOIN clients c ON o.client_id=c.id
      JOIN users u ON d.driver_id=u.id
      WHERE d.tubes_pending=true
      ORDER BY d.completion_time DESC LIMIT 50
    `);

    res.json({ by_driver: byDriver.rows, by_client: byClient.rows, pending_open: pendingOpen.rows });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// Relatório de canhotos (admin)
router.get('/reports/canhotos', authorize('admin'), async (req, res) => {
  try {
    const { date_from, date_to, driver_id, has_canhoto } = req.query;
    let sql = `
      SELECT d.id, d.status, d.completion_time, d.canhoto_photo, d.no_proof_reason,
             c.name as client_name, c.city, c.cidade,
             u.name as driver_name,
             (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=d.id) as photo_count
      FROM deliveries d
      LEFT JOIN orders o ON d.order_id=o.id
      LEFT JOIN clients c ON o.client_id=c.id
      LEFT JOIN users u ON d.driver_id=u.id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (driver_id) { sql += ` AND d.driver_id=$${i++}`; params.push(driver_id); }
    if (date_from) { sql += ` AND DATE(d.updated_at)>=$${i++}`; params.push(date_from); }
    if (date_to)   { sql += ` AND DATE(d.updated_at)<=$${i++}`; params.push(date_to); }
    if (has_canhoto === '1') {
      sql += ` AND (d.canhoto_photo IS NOT NULL OR (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=d.id)>0)`;
    } else if (has_canhoto === '0') {
      sql += ` AND d.canhoto_photo IS NULL AND (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=d.id)=0`;
    }
    sql += ' ORDER BY d.updated_at DESC LIMIT 100';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ─── CRUD principal ────────────────────────────────────────────────────────────

router.post('/routes', authorize('admin'), async (req, res) => {
  try {
    const { driver_id, vehicle_id, route_date, notes } = req.body;
    if (!driver_id || !route_date) return res.status(400).json({ error: true, message: 'Motorista e data obrigatórios' });
    const result = await query(
      'INSERT INTO routes (driver_id, vehicle_id, route_date, notes, created_at) VALUES ($1,$2,$3,$4,now()) RETURNING id',
      [driver_id, vehicle_id || null, route_date, notes || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /deliveries
router.get('/', async (req, res) => {
  try {
    let sql = `
      SELECT d.*,
             o.total_value, c.name as client_name, c.address, c.city, c.cidade, c.phone,
             u.name as driver_name, v.plate, v.model, r.notes as route_name,
             (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=d.id) as canhoto_count
      FROM deliveries d
      LEFT JOIN orders o ON d.order_id=o.id
      LEFT JOIN clients c ON o.client_id=c.id
      LEFT JOIN users u ON d.driver_id=u.id
      LEFT JOIN vehicles v ON d.vehicle_id=v.id
      LEFT JOIN routes r ON d.route_id=r.id
      WHERE 1=1`;
    const params = [];
    let i = 1;
    if (req.user.role === 'motorista') { sql += ` AND d.driver_id=$${i++}`; params.push(req.user.id); }
    if (req.query.driver_id && req.user.role === 'admin') { sql += ` AND d.driver_id=$${i++}`; params.push(req.query.driver_id); }
    if (req.query.status) { sql += ` AND d.status=$${i++}`; params.push(req.query.status); }
    if (req.query.date_from) { sql += ` AND DATE(d.created_at)>=$${i++}`; params.push(req.query.date_from); }
    if (req.query.date_to)   { sql += ` AND DATE(d.created_at)<=$${i++}`; params.push(req.query.date_to); }
    sql += ' ORDER BY d.created_at DESC';

    const result = await query(sql, params);
    const deliveries = result.rows;
    for (const d of deliveries) {
      const items = await query(
        `SELECT oi.*, COALESCE(p.nome, s.name) as sku_name, COALESCE(p.unidade, s.unit) as unit
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id=p.id
         LEFT JOIN skus s ON oi.sku_id=s.id
         WHERE oi.order_id=$1`,
        [d.order_id]
      );
      d.items = items.rows;
      d.tubes_value_p5    = (d.tubes_p5  || 0) * 0.50;
      d.tubes_value_p10   = (d.tubes_p10 || 0) * 1.00;
      d.tubes_value_total = d.tubes_value_p5 + d.tubes_value_p10;
    }
    res.json(deliveries);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /deliveries/:id/photos
router.get('/:id/photos', async (req, res) => {
  try {
    const dRes = await query('SELECT id, driver_id FROM deliveries WHERE id=$1', [req.params.id]);
    const d = dRes.rows[0];
    if (!d) return res.status(404).json({ error: true, message: 'Entrega não encontrada' });
    if (req.user.role === 'motorista' && d.driver_id !== req.user.id) return res.status(403).json({ error: true, message: 'Acesso negado' });
    const photos = await query('SELECT * FROM canhoto_photos WHERE delivery_id=$1 ORDER BY uploaded_at ASC', [req.params.id]);
    res.json(photos.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /deliveries/:id
router.get('/:id', async (req, res) => {
  try {
    const dRes = await query(
      `SELECT d.*,
              o.total_value, c.name as client_name, c.address, c.city, c.cidade, c.phone,
              u.name as driver_name, v.plate, v.model
       FROM deliveries d
       LEFT JOIN orders o ON d.order_id=o.id
       LEFT JOIN clients c ON o.client_id=c.id
       LEFT JOIN users u ON d.driver_id=u.id
       LEFT JOIN vehicles v ON d.vehicle_id=v.id
       WHERE d.id=$1`,
      [req.params.id]
    );
    const d = dRes.rows[0];
    if (!d) return res.status(404).json({ error: true, message: 'Entrega não encontrada' });
    if (req.user.role === 'motorista' && d.driver_id !== req.user.id) return res.status(403).json({ error: true, message: 'Acesso negado' });

    const items = await query(
      `SELECT oi.*, COALESCE(p.nome, s.name) as sku_name, COALESCE(p.unidade, s.unit) as unit
       FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id LEFT JOIN skus s ON oi.sku_id=s.id
       WHERE oi.order_id=$1`,
      [d.order_id]
    );
    d.items = items.rows;
    const photos = await query('SELECT * FROM canhoto_photos WHERE delivery_id=$1 ORDER BY uploaded_at ASC', [d.id]);
    d.canhoto_photos = photos.rows;
    d.tubes_value_p5    = (d.tubes_p5  || 0) * 0.50;
    d.tubes_value_p10   = (d.tubes_p10 || 0) * 1.00;
    d.tubes_value_total = d.tubes_value_p5 + d.tubes_value_p10;
    res.json(d);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// POST /deliveries
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { order_id, driver_id, vehicle_id, route_id } = req.body;
    if (!order_id || !driver_id) return res.status(400).json({ error: true, message: 'Pedido e motorista obrigatórios' });

    const orderRes = await query('SELECT * FROM orders WHERE id=$1', [order_id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: true, message: 'Pedido não encontrado' });
    if (!['pronto_expedicao','produzido'].includes(order.status)) {
      return res.status(400).json({ error: true, message: 'Pedido precisa estar pronto para expedição' });
    }

    const driverRes = await query('SELECT * FROM users WHERE id=$1 AND role=$2 AND active=true', [driver_id, 'motorista']);
    if (!driverRes.rows[0]) return res.status(400).json({ error: true, message: 'Motorista inválido' });

    const existingRes = await query(`SELECT id FROM deliveries WHERE order_id=$1 AND status NOT IN ('nao_entregue')`, [order_id]);
    if (existingRes.rows[0]) return res.status(400).json({ error: true, message: 'Pedido já tem entrega em andamento' });

    const result = await query(
      'INSERT INTO deliveries (order_id,driver_id,vehicle_id,route_id,created_at,updated_at) VALUES ($1,$2,$3,$4,now(),now()) RETURNING id',
      [order_id, driver_id, vehicle_id || null, route_id || null]
    );
    await query(`UPDATE orders SET delivery_status='EM_ROTA', driver_id=$1, updated_at=now() WHERE id=$2`, [driver_id, order_id]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PUT /deliveries/:id/status
router.put('/:id/status',
  authorize('admin','motorista'),
  upload.fields([
    { name: 'canhoto_photos', maxCount: 10 },
    { name: 'delivery_photo', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        status, observations, no_delivery_reason,
        tubes_quantity,
        tubes_had, tubes_qty_p5, tubes_qty_p10,
        tubes_pending, tubes_pending_p5, tubes_pending_p10,
        tubes_obs, no_proof_reason,
      } = req.body;

      const p5_val  = tubes_qty_p5  ? parseInt(tubes_qty_p5)  : null;
      const p10_val = tubes_qty_p10 ? parseInt(tubes_qty_p10) : null;

      const VALID_STATUS = ['pendente','saiu_entrega','chegou_cliente','entregue','ocorrencia','nao_entregue'];
      if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: true, message: 'Status inválido' });

      const dRes = await query('SELECT * FROM deliveries WHERE id=$1', [req.params.id]);
      const d = dRes.rows[0];
      if (!d) return res.status(404).json({ error: true, message: 'Entrega não encontrada' });
      if (req.user.role === 'motorista' && d.driver_id !== req.user.id) return res.status(403).json({ error: true, message: 'Acesso negado' });

      const newDriverId = req.user.role === 'admin' && req.body.driver_id
        ? parseInt(req.body.driver_id) : d.driver_id;

      const newPhotos = req.files?.canhoto_photos || [];

      // Validações ao concluir entrega
      if (status === 'entregue') {
        const errors = [];
        if (tubes_had === undefined || tubes_had === null || tubes_had === '') {
          errors.push('Informe se houve recolhimento de tubos antes de concluir.');
        }
        if (tubes_pending === undefined || tubes_pending === null || tubes_pending === '') {
          errors.push('Informe se ficou pendência de tubo antes de concluir.');
        }
        const hasLegacy  = !!d.canhoto_photo;
        const inDbRes    = await query('SELECT COUNT(*) as c FROM canhoto_photos WHERE delivery_id=$1', [d.id]);
        const hasInDb    = parseInt(inDbRes.rows[0].c) > 0;
        const hasSending = newPhotos.length > 0;
        if (!hasLegacy && !hasInDb && !hasSending) {
          errors.push('Anexe a foto do canhoto assinado para concluir a entrega.');
        }
        if (errors.length > 0) return res.status(400).json({ error: true, message: 'Dados incompletos', messages: errors });
      }

      const now = new Date().toISOString();
      const departure  = d.departure_time  || (status === 'saiu_entrega'  ? now : null);
      const arrival    = d.arrival_time    || (status === 'chegou_cliente' ? now : null);
      const completion = d.completion_time || (status === 'entregue'       ? now : null);
      const dphoto = req.files?.delivery_photo?.[0]?.filename || d.delivery_photo;

      const tubesHadVal     = tubes_had     !== undefined && tubes_had     !== '' ? (tubes_had     === 'true' || tubes_had     === '1' || tubes_had     === true) : d.tubes_had;
      const tubesPendingVal = tubes_pending !== undefined && tubes_pending !== '' ? (tubes_pending === 'true' || tubes_pending === '1' || tubes_pending === true) : d.tubes_pending;

      await query(`
        UPDATE deliveries SET
          status=$1, observations=$2, no_delivery_reason=$3,
          tubes_quantity=$4,
          tubes_had=$5, tubes_qty_p5=$6, tubes_qty_p10=$7,
          tubes_p5=$6, tubes_p10=$7,
          tubes_pending=$8, tubes_pending_p5=$9, tubes_pending_p10=$10,
          tubes_pending_qty=$11,
          tubes_obs=$12, no_proof_reason=$13,
          departure_time=$14, arrival_time=$15, completion_time=$16,
          canhoto_photo=$17, driver_id=$18,
          acted_by_id=$19, acted_by_role=$20,
          updated_at=now()
        WHERE id=$21
      `, [
        status,
        observations        || d.observations,
        no_delivery_reason  || d.no_delivery_reason,
        tubes_quantity  ? parseInt(tubes_quantity) : d.tubes_quantity,
        tubesHadVal,
        p5_val  !== null ? p5_val  : (d.tubes_qty_p5 || 0),
        p10_val !== null ? p10_val : (d.tubes_qty_p10 || 0),
        tubesPendingVal,
        tubes_pending_p5  ? parseInt(tubes_pending_p5)  : (d.tubes_pending_p5 || 0),
        tubes_pending_p10 ? parseInt(tubes_pending_p10) : (d.tubes_pending_p10 || 0),
        (parseInt(tubes_pending_p5 || 0) + parseInt(tubes_pending_p10 || 0)) || d.tubes_pending_qty,
        tubes_obs        || d.tubes_obs,
        no_proof_reason !== undefined ? no_proof_reason : d.no_proof_reason,
        departure, arrival, completion,
        dphoto, newDriverId,
        req.user.id, req.user.role,
        req.params.id,
      ]);

      // Salva novos canhotos
      for (const f of newPhotos) {
        await query('INSERT INTO canhoto_photos (delivery_id, filename) VALUES ($1,$2)', [d.id, f.filename]);
      }

      if (status === 'entregue') {
        await query(`UPDATE orders SET status='entregue', delivery_status='ENTREGUE', updated_at=now() WHERE id=$1`, [d.order_id]);
      }

      await auditLog(req.user.id, 'delivery_status_updated', 'deliveries', req.params.id, { status: d.status }, { status });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: true, message: e.message }); }
  }
);

// POST /deliveries/accept/:order_id — Motorista aceita pedido disponível
router.post('/accept/:order_id', authorize('admin','motorista'), async (req, res) => {
  try {
    const orderRes = await query(`SELECT * FROM orders WHERE id=$1 AND delivery_status='DISPONIVEL'`, [req.params.order_id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: true, message: 'Pedido não disponível para aceite' });

    const driverId  = req.user.role === 'motorista' ? req.user.id : (parseInt(req.body.driver_id) || req.user.id);
    const vehicleId = req.body.vehicle_id ? parseInt(req.body.vehicle_id) : null;

    const existingRes = await query(`SELECT id FROM deliveries WHERE order_id=$1 AND status NOT IN ('nao_entregue')`, [order.id]);
    if (existingRes.rows[0]) return res.status(400).json({ error: true, message: 'Pedido já está em rota' });

    const result = await query(
      'INSERT INTO deliveries (order_id,driver_id,vehicle_id,created_at,updated_at) VALUES ($1,$2,$3,now(),now()) RETURNING id',
      [order.id, driverId, vehicleId]
    );
    await query(`UPDATE orders SET delivery_status='EM_ROTA', driver_id=$1, updated_at=now() WHERE id=$2`, [driverId, order.id]);
    res.status(201).json({ id: result.rows[0].id, message: 'Entrega aceita com sucesso' });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PATCH /deliveries/:id/payment
router.patch('/:id/payment', authorize('admin'), async (req, res) => {
  try {
    const { payment_status } = req.body;
    if (!['pendente','pago','isento'].includes(payment_status))
      return res.status(400).json({ error: true, message: 'Status inválido. Use: pendente, pago ou isento' });
    const dRes = await query('SELECT id FROM deliveries WHERE id=$1', [req.params.id]);
    if (!dRes.rows[0]) return res.status(404).json({ error: true, message: 'Entrega não encontrada' });
    await query('UPDATE deliveries SET tubes_payment_status=$1, updated_at=now() WHERE id=$2', [payment_status, req.params.id]);
    res.json({ success: true, payment_status });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
