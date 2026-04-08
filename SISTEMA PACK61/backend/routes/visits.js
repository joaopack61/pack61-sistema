'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
    filename: (req, file, cb) => cb(null, `visit_${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// GET /visits
router.get('/', async (req, res) => {
  try {
    let sql = `SELECT v.*, c.name as client_name, c.city, c.cidade, u.name as seller_name
      FROM visits v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN users u ON v.seller_id = u.id
      WHERE 1=1`;
    const params = [];
    let i = 1;

    if (req.user.role === 'vendedor') { sql += ` AND v.seller_id=$${i++}`; params.push(req.user.id); }
    if (req.query.seller_id && req.user.role === 'admin') { sql += ` AND v.seller_id=$${i++}`; params.push(req.query.seller_id); }
    if (req.query.client_id) { sql += ` AND v.client_id=$${i++}`; params.push(req.query.client_id); }
    if (req.query.date_from) { sql += ` AND COALESCE(v.data_visita, v.visit_date) >= $${i++}`; params.push(req.query.date_from); }
    if (req.query.date_to)   { sql += ` AND COALESCE(v.data_visita, v.visit_date) <= $${i++}`; params.push(req.query.date_to); }

    sql += ' ORDER BY COALESCE(v.data_visita, v.visit_date) DESC, v.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /visits/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT v.*, c.name as client_name, u.name as seller_name
      FROM visits v LEFT JOIN clients c ON v.client_id=c.id LEFT JOIN users u ON v.seller_id=u.id
      WHERE v.id=$1`, [req.params.id]);
    const visit = result.rows[0];
    if (!visit) return res.status(404).json({ error: true, message: 'Visita não encontrada' });
    if (req.user.role === 'vendedor' && visit.seller_id !== req.user.id) return res.status(403).json({ error: true, message: 'Acesso negado' });
    res.json(visit);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// POST /visits
router.post('/', authorize('admin','vendedor'), upload.single('photo'), async (req, res) => {
  try {
    const {
      client_id, visit_date, data_visita, status, status_visita, result: visitResult,
      notes, observacoes, volume_estimado_kg, next_contact_date,
      competitor, competitor_price, product_interest, monthly_volume, tube_type,
      loss_reason, lat, lng, location_lat, location_lng,
    } = req.body;

    const effectiveDate = data_visita || visit_date;
    if (!client_id || !effectiveDate) return res.status(400).json({ error: true, message: 'Cliente e data são obrigatórios' });

    const seller_id = req.user.role === 'vendedor' ? req.user.id : (req.body.seller_id || req.user.id);
    const hasLocation = !!(lat || lng || location_lat || location_lng);

    const dbResult = await query(
      `INSERT INTO visits (client_id, seller_id, visit_date, data_visita, status, status_visita, result, notes, observacoes, volume_estimado_kg, next_contact_date, competitor, competitor_price, product_interest, monthly_volume, tube_type, loss_reason, has_location, location_lat, location_lng, created_at, updated_at)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),now()) RETURNING id`,
      [
        client_id, seller_id, effectiveDate,
        status || status_visita || 'visitado',
        status_visita || status || 'visitado',
        visitResult || null,
        notes || observacoes || null,
        observacoes || notes || null,
        volume_estimado_kg || null,
        next_contact_date || null,
        competitor || null,
        competitor_price || null,
        product_interest || null,
        monthly_volume || null,
        tube_type || null,
        loss_reason || null,
        hasLocation,
        location_lat || lat || null,
        location_lng || lng || null,
      ]
    );
    await auditLog(req.user.id, 'visit_created', 'visits', dbResult.rows[0].id, null, { client_id, effectiveDate });
    res.status(201).json({ id: dbResult.rows[0].id });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PUT /visits/:id
router.put('/:id', authorize('admin','vendedor'), async (req, res) => {
  try {
    const visitRes = await query('SELECT * FROM visits WHERE id=$1', [req.params.id]);
    const visit = visitRes.rows[0];
    if (!visit) return res.status(404).json({ error: true, message: 'Visita não encontrada' });
    if (req.user.role === 'vendedor' && visit.seller_id !== req.user.id) return res.status(403).json({ error: true, message: 'Acesso negado' });

    const { observacoes, notes, next_contact_date, competitor, competitor_price, status, status_visita, result: visitResult, loss_reason } = req.body;
    await query(
      `UPDATE visits SET observacoes=COALESCE($1,observacoes), notes=COALESCE($1,notes), next_contact_date=COALESCE($2,next_contact_date), competitor=COALESCE($3,competitor), competitor_price=COALESCE($4,competitor_price), status=COALESCE($5,status), status_visita=COALESCE($6,status_visita), result=COALESCE($7,result), loss_reason=COALESCE($8,loss_reason), updated_at=now() WHERE id=$9`,
      [observacoes||notes||null, next_contact_date||null, competitor||null, competitor_price||null, status||null, status_visita||status||null, visitResult||null, loss_reason||null, req.params.id]
    );
    await auditLog(req.user.id, 'visit_updated', 'visits', req.params.id, null, req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
