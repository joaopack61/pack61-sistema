'use strict';
const express = require('express');
const { query, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { checkOverdue } = require('../services/financialService');

const router = express.Router();
router.use(authenticate, authorize('admin'));

// GET /financial/tubes
router.get('/tubes', async (req, res) => {
  try {
    let sql = `SELECT tf.*, c.name as client_name, c.razao_social, u.name as driver_name, o.total_value
               FROM tube_financial tf
               LEFT JOIN clients c ON tf.client_id=c.id
               LEFT JOIN users u ON tf.driver_id=u.id
               LEFT JOIN orders o ON tf.order_id=o.id
               WHERE 1=1`;
    const params = [];
    let i = 1;
    if (req.query.status) { sql += ` AND tf.status_pagamento=$${i++}`; params.push(req.query.status); }
    if (req.query.driver_id) { sql += ` AND tf.driver_id=$${i++}`; params.push(req.query.driver_id); }
    sql += ' ORDER BY tf.created_at DESC LIMIT 200';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /financial/tubes/summary
router.get('/tubes/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.name as driver_name,
        c.name as client_name,
        SUM(tf.quantidade_p5) as total_p5,
        SUM(tf.quantidade_p10) as total_p10,
        SUM(tf.valor_total) as total_valor,
        SUM(CASE WHEN tf.status_pagamento='PENDENTE' THEN tf.valor_total ELSE 0 END) as pendente,
        SUM(CASE WHEN tf.status_pagamento='PAGO' THEN tf.valor_total ELSE 0 END) as pago
      FROM tube_financial tf
      LEFT JOIN users u ON tf.driver_id=u.id
      LEFT JOIN clients c ON tf.client_id=c.id
      GROUP BY u.name, c.name
      ORDER BY pendente DESC
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PUT /financial/tubes/:id/pay
router.put('/tubes/:id/pay', async (req, res) => {
  try {
    await query(`UPDATE tube_financial SET status_pagamento='PAGO', data_pagamento=CURRENT_DATE, updated_at=now() WHERE id=$1`, [req.params.id]);
    await auditLog(req.user.id, 'tube_paid', 'tube_financial', req.params.id, null, { status: 'PAGO' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /financial/payments
router.get('/payments', async (req, res) => {
  try {
    await checkOverdue();
    let sql = `SELECT p.*, c.name as client_name, c.razao_social, o.total_value as order_total
               FROM payments p
               LEFT JOIN clients c ON p.client_id=c.id
               LEFT JOIN orders o ON p.order_id=o.id
               WHERE 1=1`;
    const params = [];
    let i = 1;
    if (req.query.status) { sql += ` AND p.status=$${i++}`; params.push(req.query.status); }
    if (req.query.client_id) { sql += ` AND p.client_id=$${i++}`; params.push(req.query.client_id); }
    sql += ' ORDER BY p.data_vencimento DESC LIMIT 200';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PUT /financial/payments/:id/pay
router.put('/payments/:id/pay', async (req, res) => {
  try {
    const { forma_pagamento, observacoes } = req.body;
    await query(
      `UPDATE payments SET status='PAGO', data_pagamento=CURRENT_DATE, forma_pagamento=COALESCE($1,forma_pagamento), observacoes=COALESCE($2,observacoes), updated_at=now() WHERE id=$3`,
      [forma_pagamento||null, observacoes||null, req.params.id]
    );
    await auditLog(req.user.id, 'payment_registered', 'payments', req.params.id, null, { status: 'PAGO', forma_pagamento });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /financial/overdue
router.get('/overdue', async (req, res) => {
  try {
    const count = await checkOverdue();
    const result = await query(`
      SELECT p.*, c.name as client_name, c.contato_telefone
      FROM payments p LEFT JOIN clients c ON p.client_id=c.id
      WHERE p.status='ATRASADO'
      ORDER BY p.data_vencimento ASC LIMIT 100
    `);
    res.json({ updated: count, payments: result.rows });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
