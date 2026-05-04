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
    filename: (req, file, cb) => {
      const prefix = file.fieldname === 'foto_fachada' ? 'fach' : 'visit';
      cb(null, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// aceita foto_fachada OU photo
const uploadAny = upload.fields([{ name: 'foto_fachada', maxCount: 1 }, { name: 'photo', maxCount: 1 }]);

// ── GET /visits ──────────────────────────────────────────────────────────────
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
    if (req.query.followup_pending === '1') {
      sql += ` AND v.data_followup IS NOT NULL AND v.order_id IS NULL`;
    }

    sql += ' ORDER BY COALESCE(v.data_visita, v.visit_date) DESC, v.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ── GET /visits/:id ──────────────────────────────────────────────────────────
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

// ── POST /visits ─────────────────────────────────────────────────────────────
router.post('/', authorize('admin','vendedor'), uploadAny, async (req, res) => {
  try {
    const b = req.body;
    const files = req.files || {};
    const fotoFile = files.foto_fachada?.[0] || files.photo?.[0];
    const fotoUrl  = fotoFile ? `/uploads/${fotoFile.filename}` : null;

    const effectiveDate = b.data_visita || b.visit_date;
    if (!b.client_id || !effectiveDate) {
      return res.status(400).json({ error: true, message: 'Cliente e data são obrigatórios' });
    }

    const seller_id = req.user.role === 'vendedor' ? req.user.id : (parseInt(b.seller_id) || req.user.id);

    // Pré-orçamento items (vem como JSON string)
    let orcamentoItems = null;
    if (b.orcamento_items) {
      try { orcamentoItems = typeof b.orcamento_items === 'string' ? JSON.parse(b.orcamento_items) : b.orcamento_items; }
      catch { orcamentoItems = null; }
    }

    const dbResult = await query(
      `INSERT INTO visits
         (client_id, seller_id, visit_date, data_visita,
          status, status_visita, result, notes, observacoes,
          volume_estimado_kg, next_contact_date,
          competitor, competitor_price, product_interest, monthly_volume,
          tube_type, loss_reason, has_location, location_lat, location_lng,
          classificacao_cliente, contato_atendeu, telefone_contato,
          gerou_orcamento, valor_orcamento, foto_fachada_url,
          data_followup, motivo_followup,
          orcamento_items, orcamento_total, orcamento_desconto,
          took_order, no_order_reason,
          created_at, updated_at)
       VALUES
         ($1,$2,$3,$3,
          $4,$4,$5,$6,$6,
          $7,$8,
          $9,$10,$11,$12,
          $13,$14,$15,$16,$17,
          $18,$19,$20,
          $21,$22,$23,
          $24,$25,
          $26::jsonb,$27,$28,
          $29,$30,
          now(),now())
       RETURNING id`,
      [
        parseInt(b.client_id), seller_id, effectiveDate,
        b.status_visita || b.status || 'visitado',
        b.result || null,
        b.observations || b.observacoes || b.notes || null,
        b.volume_estimado_kg || null,
        b.next_contact_date || b.next_purchase_date || null,
        b.competitor || null,
        b.competitor_price || null,
        b.product_interest || b.products_interest || null,
        b.monthly_volume || null,
        b.tube_type || null,
        b.loss_reason || b.no_order_reason || null,
        !!(b.lat || b.location_lat),
        b.location_lat || b.lat || null,
        b.location_lng || b.lng || null,
        b.classificacao_cliente || 'B',
        b.contato_atendeu || null,
        b.telefone_contato || null,
        b.gerou_orcamento === 'true' || b.gerou_orcamento === '1' || b.gerou_orcamento === true,
        parseFloat(b.valor_orcamento) || null,
        fotoUrl,
        b.data_followup || null,
        b.motivo_followup || null,
        orcamentoItems ? JSON.stringify(orcamentoItems) : null,
        parseFloat(b.orcamento_total) || null,
        parseFloat(b.orcamento_desconto) || 0,
        b.took_order === '1' || b.took_order === 1 || b.took_order === true ? true : false,
        b.no_order_reason || b.loss_reason || null,
      ]
    );

    await auditLog(req.user.id, 'visit_created', 'visits', dbResult.rows[0].id, null, { client_id: b.client_id, effectiveDate });
    res.status(201).json({ id: dbResult.rows[0].id });
  } catch (e) {
    console.error('[POST /visits] ERRO:', e.message, e.detail || '');
    res.status(500).json({ error: true, message: e.message, detail: e.detail || null });
  }
});

// ── PUT /visits/:id ───────────────────────────────────────────────────────────
router.put('/:id', authorize('admin','vendedor'), uploadAny, async (req, res) => {
  try {
    const visitRes = await query('SELECT * FROM visits WHERE id=$1', [req.params.id]);
    const visit = visitRes.rows[0];
    if (!visit) return res.status(404).json({ error: true, message: 'Visita não encontrada' });
    if (req.user.role === 'vendedor' && visit.seller_id !== req.user.id) return res.status(403).json({ error: true, message: 'Acesso negado' });

    const b = req.body;
    await query(
      `UPDATE visits SET
         observacoes=COALESCE($1,observacoes), notes=COALESCE($1,notes),
         next_contact_date=COALESCE($2,next_contact_date),
         competitor=COALESCE($3,competitor), competitor_price=COALESCE($4,competitor_price),
         status=COALESCE($5,status), status_visita=COALESCE($5,status_visita),
         result=COALESCE($6,result), loss_reason=COALESCE($7,loss_reason),
         data_followup=COALESCE($8,data_followup), motivo_followup=COALESCE($9,motivo_followup),
         updated_at=now()
       WHERE id=$10`,
      [
        b.observacoes || b.notes || null,
        b.next_contact_date || null,
        b.competitor || null, b.competitor_price || null,
        b.status || b.status_visita || null,
        b.result || null, b.loss_reason || null,
        b.data_followup || null, b.motivo_followup || null,
        req.params.id,
      ]
    );
    await auditLog(req.user.id, 'visit_updated', 'visits', req.params.id, null, b);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
