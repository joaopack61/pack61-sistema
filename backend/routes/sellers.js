'use strict';
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { query } = require('../database');
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
    filename: (req, file, cb) => cb(null, `fach_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── GET /sellers — lista de vendedores com KPIs do mês (admin) ──────────────
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-01`;

    const result = await query(`
      SELECT
        u.id, u.name, u.email, u.phone, u.active,
        COUNT(DISTINCT v.id) FILTER (WHERE COALESCE(v.data_visita, v.visit_date) >= $1) AS visitas_mes,
        COUNT(DISTINCT o.id) FILTER (WHERE DATE(o.created_at) >= $1) AS pedidos_mes,
        COALESCE(SUM(o.total_value) FILTER (WHERE DATE(o.created_at) >= $1), 0) AS volume_mes
      FROM users u
      LEFT JOIN visits v ON v.seller_id = u.id
      LEFT JOIN orders o ON o.seller_id = u.id
      WHERE u.role = 'vendedor'
      GROUP BY u.id, u.name, u.email, u.phone, u.active
      ORDER BY volume_mes DESC
    `, [monthStart]);

    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ── GET /sellers/:id — detalhe de um vendedor ────────────────────────────────
router.get('/:id', authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const now = new Date();
    const todayStr    = now.toISOString().split('T')[0];
    const weekStart   = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); const weekStr = weekStart.toISOString().split('T')[0];
    const monthStart  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-01`;

    const [userRes, statsRes, visitsRes] = await Promise.all([
      query('SELECT id, name, email, phone, active FROM users WHERE id=$1 AND role=$2', [id, 'vendedor']),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(data_visita, visit_date) = $2) AS visitas_hoje,
          COUNT(*) FILTER (WHERE COALESCE(data_visita, visit_date) >= $3) AS visitas_semana,
          COUNT(*) FILTER (WHERE COALESCE(data_visita, visit_date) >= $4) AS visitas_mes
        FROM visits WHERE seller_id=$1
      `, [id, todayStr, weekStr, monthStart]),
      query(`
        SELECT v.*,
          COALESCE(c.name, v.cliente_nome) AS client_name,
          c.cnpj AS client_cnpj,
          c.city AS client_city,
          c.cidade AS client_city2
        FROM visits v
        LEFT JOIN clients c ON v.client_id = c.id
        WHERE v.seller_id = $1
        ORDER BY COALESCE(v.data_visita, v.visit_date) DESC, v.created_at DESC
        LIMIT 200
      `, [id]),
    ]);

    if (!userRes.rows[0]) return res.status(404).json({ error: true, message: 'Vendedor não encontrado' });

    res.json({
      seller: userRes.rows[0],
      stats: statsRes.rows[0],
      visits: visitsRes.rows,
    });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ── POST /sellers/visits — registra visita com foto de fachada ───────────────
router.post('/visits', authorize('admin','vendedor'), upload.single('foto_fachada'), async (req, res) => {
  try {
    const {
      client_id, seller_id, cliente_nome, cnpj,
      visit_date, classificacao_cliente, contato_atendeu,
      telefone_contato, status_visita, gerou_orcamento,
      valor_orcamento, observations, observacoes,
    } = req.body;

    const fotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const sellerId = req.user.role === 'admin'
      ? (parseInt(seller_id) || req.user.id)
      : req.user.id;

    const r = await query(`
      INSERT INTO visits
        (seller_id, client_id, cliente_nome, cnpj, visit_date, data_visita,
         classificacao_cliente, contato_atendeu, telefone_contato,
         status_visita, gerou_orcamento, valor_orcamento,
         observacoes, foto_fachada_url, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
      RETURNING id
    `, [
      sellerId,
      parseInt(client_id) || null,
      cliente_nome || null,
      cnpj || null,
      visit_date || new Date().toISOString().split('T')[0],
      classificacao_cliente || 'B',
      contato_atendeu || null,
      telefone_contato || null,
      status_visita || 'VISITADO',
      gerou_orcamento === 'true' || gerou_orcamento === true ? true : false,
      parseFloat(valor_orcamento) || null,
      observations || observacoes || null,
      fotoUrl,
    ]);

    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
