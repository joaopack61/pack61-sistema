'use strict';
const express = require('express');
const { query } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { checkOverdue } = require('../services/financialService');

const router = express.Router();
router.use(authenticate, authorize('admin'));

// GET /dashboard (summary) — mantido para compatibilidade
router.get('/', async (req, res) => {
  try { return res.redirect('/api/dashboard/summary'); } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    await checkOverdue();

    const [visitsWeek, visitsMonth, ordersMonth, ordersDelivered, revenueMonth, revenuePending, ticketMedio, lowStock, deliveryByStatus, tubesPending, inadimplencia, motoristasAtivos, highAttempts] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM visits WHERE data_visita >= CURRENT_DATE - INTERVAL '7 days'`),
      query(`SELECT COUNT(*) as count FROM visits WHERE DATE_TRUNC('month', data_visita) = DATE_TRUNC('month', CURRENT_DATE)`),
      query(`SELECT COUNT(*) as count FROM orders WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', now())`),
      query(`SELECT COUNT(*) as count FROM orders WHERE delivery_status='ENTREGUE' AND DATE_TRUNC('month', delivered_at) = DATE_TRUNC('month', now())`),
      query(`SELECT COALESCE(SUM(total_value),0) as total FROM orders WHERE delivery_status='ENTREGUE' AND DATE_TRUNC('month', delivered_at) = DATE_TRUNC('month', now())`),
      query(`SELECT COALESCE(SUM(total_value),0) as total FROM orders WHERE delivery_status NOT IN ('ENTREGUE','AGUARDANDO') AND status != 'cancelado'`),
      query(`SELECT COALESCE(AVG(total_value),0) as avg FROM orders WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', now())`),
      query(`SELECT COUNT(*) as count FROM skus s JOIN stock st ON s.id=st.sku_id WHERE st.quantity_available <= s.min_stock AND s.active=true`),
      query(`SELECT delivery_status, COUNT(*) as count FROM orders WHERE delivery_status IS NOT NULL GROUP BY delivery_status`),
      query(`SELECT COALESCE(SUM(valor_total),0) as total FROM tube_financial WHERE status_pagamento='PENDENTE'`),
      query(`SELECT COALESCE(SUM(valor),0) as total FROM payments WHERE status='ATRASADO'`),
      query(`SELECT COUNT(DISTINCT driver_id) as count FROM orders WHERE delivery_status='EM_ROTA'`),
      query(`SELECT COUNT(*) as count FROM orders WHERE delivery_attempts >= 2`),
    ]);

    const deliveryStatusMap = {};
    deliveryByStatus.rows.forEach(r => { deliveryStatusMap[r.delivery_status] = parseInt(r.count); });

    res.json({
      visits_week: parseInt(visitsWeek.rows[0].count),
      visits_month: parseInt(visitsMonth.rows[0].count),
      orders_month: parseInt(ordersMonth.rows[0].count),
      orders_delivered: parseInt(ordersDelivered.rows[0].count),
      revenue_month: parseFloat(revenueMonth.rows[0].total),
      revenue_pending: parseFloat(revenuePending.rows[0].total),
      ticket_medio: parseFloat(ticketMedio.rows[0].avg),
      low_stock: parseInt(lowStock.rows[0].count),
      delivery_status: deliveryStatusMap,
      tubes_pending_value: parseFloat(tubesPending.rows[0].total),
      inadimplencia_total: parseFloat(inadimplencia.rows[0].total),
      motoristas_ativos: parseInt(motoristasAtivos.rows[0].count),
      high_attempts: parseInt(highAttempts.rows[0].count),
    });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /dashboard/sellers
router.get('/sellers', async (req, res) => {
  try {
    const result = await query(`
      SELECT u.name as seller_name, u.id,
        COUNT(DISTINCT v.id) as total_visits,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_value),0) as total_revenue,
        ROUND(COUNT(DISTINCT o.id)::numeric / NULLIF(COUNT(DISTINCT v.id),0) * 100, 1) as conversion_rate
      FROM users u
      LEFT JOIN visits v ON v.seller_id=u.id AND v.data_visita >= CURRENT_DATE - INTERVAL '30 days'
      LEFT JOIN orders o ON o.seller_id=u.id AND o.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      WHERE u.role='vendedor' AND u.active=true
      GROUP BY u.id, u.name
      ORDER BY total_revenue DESC
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /dashboard/drivers
router.get('/drivers', async (req, res) => {
  try {
    const result = await query(`
      SELECT u.name as driver_name, u.id,
        COUNT(CASE WHEN o.delivery_status='ENTREGUE' THEN 1 END) as total_delivered,
        COUNT(CASE WHEN o.delivery_status='EM_ROTA' THEN 1 END) as em_rota_agora,
        COALESCE(AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.assigned_at))/60)::int, 0) as avg_minutes,
        COALESCE(SUM(o.delivery_attempts),0) as total_attempts
      FROM users u
      LEFT JOIN orders o ON o.driver_id=u.id AND o.assigned_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      WHERE u.role='motorista' AND u.active=true
      GROUP BY u.id, u.name
      ORDER BY total_delivered DESC
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /dashboard/production
router.get('/production', async (req, res) => {
  try {
    const result = await query(`
      SELECT status, COUNT(*) as count
      FROM orders
      WHERE status IN ('pendente','em_producao','produzido','pronto_expedicao')
      GROUP BY status
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
