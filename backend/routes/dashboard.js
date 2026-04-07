const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDb();
  const role = req.user.role;
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  if (role === 'admin') {
    const visits_today = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE visit_date=?`).get(today).c;
    const visits_week = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE visit_date>=?`).get(weekStart).c;
    const visits_month = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE visit_date>=?`).get(monthStart).c;
    const orders_pending = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='pendente'`).get().c;
    const orders_production = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='em_producao'`).get().c;
    const orders_ready = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='pronto_expedicao'`).get().c;
    const orders_delivered = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='entregue' AND DATE(updated_at)>=?`).get(monthStart).c;
    const deliveries_with_canhoto = db.prepare(`SELECT COUNT(*) as c FROM deliveries WHERE (canhoto_photo IS NOT NULL OR (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=deliveries.id)>0) AND DATE(updated_at)>=?`).get(monthStart).c;
    const deliveries_without_canhoto = db.prepare(`SELECT COUNT(*) as c FROM deliveries WHERE status='entregue' AND canhoto_photo IS NULL AND (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=deliveries.id)=0 AND DATE(updated_at)>=?`).get(monthStart).c;
    const tubes_month = db.prepare(`SELECT COALESCE(SUM(tubes_quantity),0) as t FROM deliveries WHERE tubes_had=1 AND DATE(updated_at)>=?`).get(monthStart).t;
    const tubes_week = db.prepare(`SELECT COALESCE(SUM(tubes_quantity),0) as t FROM deliveries WHERE tubes_had=1 AND DATE(updated_at)>=?`).get(weekStart).t;
    const tubes_p5_month  = db.prepare(`SELECT COALESCE(SUM(tubes_qty_p5),0) as t FROM deliveries WHERE tubes_had=1 AND DATE(updated_at)>=?`).get(monthStart).t;
    const tubes_p10_month = db.prepare(`SELECT COALESCE(SUM(tubes_qty_p10),0) as t FROM deliveries WHERE tubes_had=1 AND DATE(updated_at)>=?`).get(monthStart).t;
    const tubes_pending_p5_open  = db.prepare(`SELECT COALESCE(SUM(tubes_pending_p5),0) as t FROM deliveries WHERE tubes_pending=1`).get().t;
    const tubes_pending_p10_open = db.prepare(`SELECT COALESCE(SUM(tubes_pending_p10),0) as t FROM deliveries WHERE tubes_pending=1`).get().t;
    const tubes_pending_open = db.prepare(`SELECT COUNT(*) as c FROM deliveries WHERE tubes_pending=1`).get().c;
    const low_stock = db.prepare(`SELECT COUNT(*) as c FROM skus s LEFT JOIN stock st ON s.id=st.sku_id WHERE s.active=1 AND st.quantity_available<=s.min_stock`).get().c;
    const total_clients = db.prepare(`SELECT COUNT(*) as c FROM clients WHERE active=1`).get().c;

    const top_sellers = db.prepare(`SELECT u.name, COUNT(o.id) as total_orders, COALESCE(SUM(o.total_value),0) as total_value FROM orders o LEFT JOIN users u ON o.seller_id=u.id WHERE DATE(o.created_at)>=? GROUP BY o.seller_id ORDER BY total_orders DESC LIMIT 5`).all(monthStart);
    const order_status_chart = db.prepare(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`).all();
    const visits_by_seller = db.prepare(`SELECT u.name, COUNT(v.id) as total FROM visits v LEFT JOIN users u ON v.seller_id=u.id WHERE v.visit_date>=? GROUP BY v.seller_id`).all(monthStart);
    const loss_reasons = db.prepare(`SELECT no_order_reason, COUNT(*) as count FROM visits WHERE took_order=0 AND no_order_reason IS NOT NULL AND visit_date>=? GROUP BY no_order_reason ORDER BY count DESC LIMIT 5`).all(monthStart);

    // KPIs Financeiros
    const revenue_month = db.prepare(`SELECT COALESCE(SUM(total_value),0) as v FROM orders WHERE status='entregue' AND DATE(updated_at)>=?`).get(monthStart).v;
    const revenue_pending = db.prepare(`SELECT COALESCE(SUM(total_value),0) as v FROM orders WHERE payment_status IN ('pendente','faturado') AND status NOT IN ('cancelado')`).get().v;
    const orders_paid = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE payment_status='pago' AND DATE(updated_at)>=?`).get(monthStart).c;
    const orders_month_total = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total_value),0) as v FROM orders WHERE DATE(created_at)>=?`).get(monthStart);
    const ticket_medio = orders_month_total.c > 0 ? Math.round(orders_month_total.v / orders_month_total.c) : 0;
    const revenue_by_day = db.prepare(`SELECT DATE(created_at) as day, COALESCE(SUM(total_value),0) as total FROM orders WHERE DATE(created_at)>=? AND status!='cancelado' GROUP BY DATE(created_at) ORDER BY day ASC`).all(monthStart);

    return res.json({ visits_today, visits_week, visits_month, orders_pending, orders_production, orders_ready, orders_delivered, deliveries_with_canhoto, deliveries_without_canhoto, tubes_month, tubes_week, tubes_p5_month, tubes_p10_month, tubes_pending_open, tubes_pending_p5_open, tubes_pending_p10_open, low_stock, total_clients, top_sellers, order_status_chart, visits_by_seller, loss_reasons, revenue_month, revenue_pending, orders_paid, ticket_medio, revenue_by_day, orders_month: orders_month_total.c });
  }

  if (role === 'vendedor') {
    const my_visits_today = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE seller_id=? AND visit_date=?`).get(userId, today).c;
    const my_visits_week = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE seller_id=? AND visit_date>=?`).get(userId, weekStart).c;
    const my_orders_month = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE seller_id=? AND DATE(created_at)>=?`).get(userId, monthStart).c;
    const my_orders_value = db.prepare(`SELECT COALESCE(SUM(total_value),0) as v FROM orders WHERE seller_id=? AND DATE(created_at)>=?`).get(userId, monthStart).v;
    const visits_no_order = db.prepare(`SELECT COUNT(*) as c FROM visits WHERE seller_id=? AND took_order=0 AND visit_date>=?`).get(userId, monthStart).c;
    const next_purchases = db.prepare(`SELECT v.next_purchase_date, c.name as client_name FROM visits v LEFT JOIN clients c ON v.client_id=c.id WHERE v.seller_id=? AND v.next_purchase_date>=? ORDER BY v.next_purchase_date ASC LIMIT 10`).all(userId, today);
    const loss_reasons = db.prepare(`SELECT no_order_reason, COUNT(*) as count FROM visits WHERE seller_id=? AND took_order=0 AND no_order_reason IS NOT NULL GROUP BY no_order_reason ORDER BY count DESC LIMIT 5`).all(userId);
    const recent_visits = db.prepare(`SELECT v.*, c.name as client_name FROM visits v LEFT JOIN clients c ON v.client_id=c.id WHERE v.seller_id=? ORDER BY v.visit_date DESC LIMIT 5`).all(userId);
    const conversion_rate = my_visits_week > 0 ? Math.round(((my_visits_week - visits_no_order) / my_visits_week) * 100) : 0;
    return res.json({ my_visits_today, my_visits_week, my_orders_month, my_orders_value, visits_no_order, next_purchases, loss_reasons, recent_visits, conversion_rate });
  }

  if (role === 'motorista') {
    const pending = db.prepare(`SELECT COUNT(*) as c FROM deliveries WHERE driver_id=? AND status='pendente'`).get(userId).c;
    const done_today = db.prepare(`SELECT COUNT(*) as c FROM deliveries WHERE driver_id=? AND status='entregue' AND DATE(updated_at)=?`).get(userId, today).c;
    const with_canhoto = db.prepare(`SELECT COUNT(*) as c FROM deliveries WHERE driver_id=? AND (canhoto_photo IS NOT NULL OR (SELECT COUNT(*) FROM canhoto_photos cp WHERE cp.delivery_id=deliveries.id)>0) AND DATE(updated_at)>=?`).get(userId, monthStart).c;
    const tubes_today = db.prepare(`SELECT COALESCE(SUM(tubes_quantity),0) as t FROM deliveries WHERE driver_id=? AND tubes_had=1 AND DATE(updated_at)=?`).get(userId, today).t;
    const tubes_pending_count = db.prepare(`SELECT COUNT(*) as c FROM deliveries WHERE driver_id=? AND tubes_pending=1`).get(userId).c;
    const pending_list = db.prepare(`SELECT d.*,c.name as client_name,c.address,c.city FROM deliveries d LEFT JOIN orders o ON d.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id WHERE d.driver_id=? AND d.status IN ('pendente','saiu_entrega','chegou_cliente') ORDER BY d.created_at`).all(userId);
    return res.json({ pending, done_today, with_canhoto, tubes_today, tubes_pending_count, pending_list });
  }

  if (role === 'producao') {
    const pending = db.prepare(`SELECT COUNT(*) as c FROM production_orders WHERE status='pendente'`).get().c;
    const in_production = db.prepare(`SELECT COUNT(*) as c FROM production_orders WHERE status='em_producao'`).get().c;
    const ready = db.prepare(`SELECT COUNT(*) as c FROM production_orders WHERE status='pronto_expedicao'`).get().c;
    const done_month = db.prepare(`SELECT COUNT(*) as c FROM production_orders WHERE status IN ('produzido','pronto_expedicao') AND DATE(updated_at)>=?`).get(monthStart).c;
    const low_stock = db.prepare(`SELECT s.code, s.name, st.quantity_available, s.min_stock FROM skus s LEFT JOIN stock st ON s.id=st.sku_id WHERE s.active=1 AND st.quantity_available<=s.min_stock LIMIT 5`).all();
    const recent_movements = db.prepare(`SELECT sm.*, s.name as sku_name FROM stock_movements sm LEFT JOIN skus s ON sm.sku_id=s.id ORDER BY sm.created_at DESC LIMIT 5`).all();
    return res.json({ pending, in_production, ready, done_month, low_stock, recent_movements });
  }

  res.json({});
});

module.exports = router;
