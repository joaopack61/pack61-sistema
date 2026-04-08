'use strict';
const express = require('express');
const { query, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin','producao'));

// GET /production
router.get('/', async (req, res) => {
  try {
    let sql = `SELECT po.*, o.total_value, o.delivery_date, o.notes as order_notes,
      c.name as client_name, c.city, c.cidade, u.name as seller_name, op.name as operator_name
      FROM production_orders po
      LEFT JOIN orders o ON po.order_id = o.id
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.seller_id = u.id
      LEFT JOIN users op ON po.operator_id = op.id
      WHERE 1=1`;
    const params = [];
    let i = 1;
    if (req.query.status) { sql += ` AND po.status=$${i++}`; params.push(req.query.status); }
    sql += ' ORDER BY po.created_at DESC';

    const result = await query(sql, params);
    const prodOrders = result.rows;
    for (const p of prodOrders) {
      const items = await query(
        `SELECT oi.*, COALESCE(pr.nome, s.name) as sku_name, s.code
         FROM order_items oi
         LEFT JOIN products pr ON oi.product_id=pr.id
         LEFT JOIN skus s ON oi.sku_id=s.id
         WHERE oi.order_id=$1`,
        [p.order_id]
      );
      p.items = items.rows;
    }
    res.json(prodOrders);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /production/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT po.*, o.total_value, o.delivery_date, c.name as client_name, u.name as seller_name, op.name as operator_name
       FROM production_orders po
       LEFT JOIN orders o ON po.order_id=o.id
       LEFT JOIN clients c ON o.client_id=c.id
       LEFT JOIN users u ON o.seller_id=u.id
       LEFT JOIN users op ON po.operator_id=op.id
       WHERE po.id=$1`,
      [req.params.id]
    );
    const p = result.rows[0];
    if (!p) return res.status(404).json({ error: true, message: 'Ordem não encontrada' });
    const items = await query(
      `SELECT oi.*, COALESCE(pr.nome, s.name) as sku_name, s.code
       FROM order_items oi
       LEFT JOIN products pr ON oi.product_id=pr.id
       LEFT JOIN skus s ON oi.sku_id=s.id
       WHERE oi.order_id=$1`,
      [p.order_id]
    );
    p.items = items.rows;
    res.json(p);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PUT /production/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const pRes = await query('SELECT * FROM production_orders WHERE id=$1', [req.params.id]);
    const p = pRes.rows[0];
    if (!p) return res.status(404).json({ error: true, message: 'Ordem não encontrada' });

    const now = new Date().toISOString();
    let started_at = p.started_at;
    let finished_at = p.finished_at;

    if (status === 'em_producao' && !started_at) started_at = now;
    if ((status === 'produzido' || status === 'pronto_expedicao') && !finished_at) finished_at = now;

    await query(
      'UPDATE production_orders SET status=$1, operator_id=$2, started_at=$3, finished_at=$4, notes=$5, updated_at=now() WHERE id=$6',
      [status, req.user.id, started_at, finished_at, notes || p.notes, req.params.id]
    );
    await query('UPDATE orders SET status=$1, updated_at=now() WHERE id=$2', [status, p.order_id]);

    await auditLog(req.user.id, 'production_status_changed', 'production_orders', req.params.id, { status: p.status }, { status });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
