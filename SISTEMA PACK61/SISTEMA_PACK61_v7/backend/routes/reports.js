const express = require('express');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

function buildDateFilter(alias, from, to, params) {
  let q = '';
  if (from) { q += ` AND DATE(${alias}.created_at) >= ?`; params.push(from); }
  if (to) { q += ` AND DATE(${alias}.created_at) <= ?`; params.push(to); }
  return q;
}

router.get('/visits', (req, res) => {
  const { date_from, date_to, seller_id, city } = req.query;
  const params = [];
  let q = `SELECT v.*, c.name as client_name, c.city, u.name as seller_name FROM visits v LEFT JOIN clients c ON v.client_id=c.id LEFT JOIN users u ON v.seller_id=u.id WHERE 1=1`;
  if (seller_id) { q += ' AND v.seller_id=?'; params.push(seller_id); }
  if (city) { q += ' AND c.city=?'; params.push(city); }
  if (date_from) { q += ' AND v.visit_date>=?'; params.push(date_from); }
  if (date_to) { q += ' AND v.visit_date<=?'; params.push(date_to); }
  q += ' ORDER BY v.visit_date DESC';
  res.json(getDb().prepare(q).all(...params));
});

router.get('/orders', (req, res) => {
  const { date_from, date_to, seller_id, status, client_id } = req.query;
  const params = [];
  let q = `SELECT o.*, c.name as client_name, c.city, u.name as seller_name FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.seller_id=u.id WHERE 1=1`;
  if (seller_id) { q += ' AND o.seller_id=?'; params.push(seller_id); }
  if (status) { q += ' AND o.status=?'; params.push(status); }
  if (client_id) { q += ' AND o.client_id=?'; params.push(client_id); }
  if (date_from) { q += ' AND DATE(o.created_at)>=?'; params.push(date_from); }
  if (date_to) { q += ' AND DATE(o.created_at)<=?'; params.push(date_to); }
  q += ' ORDER BY o.created_at DESC';
  const orders = getDb().prepare(q).all(...params);
  orders.forEach(o => {
    o.items = getDb().prepare(`SELECT oi.*, s.name as sku_name FROM order_items oi LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=?`).all(o.id);
  });
  res.json(orders);
});

router.get('/deliveries', (req, res) => {
  const { date_from, date_to, driver_id, status } = req.query;
  const params = [];
  let q = `SELECT d.*, c.name as client_name, c.city, u.name as driver_name, v.plate FROM deliveries d LEFT JOIN orders o ON d.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON d.driver_id=u.id LEFT JOIN vehicles v ON d.vehicle_id=v.id WHERE 1=1`;
  if (driver_id) { q += ' AND d.driver_id=?'; params.push(driver_id); }
  if (status) { q += ' AND d.status=?'; params.push(status); }
  if (date_from) { q += ' AND DATE(d.created_at)>=?'; params.push(date_from); }
  if (date_to) { q += ' AND DATE(d.created_at)<=?'; params.push(date_to); }
  q += ' ORDER BY d.created_at DESC';
  res.json(getDb().prepare(q).all(...params));
});

router.get('/stock', (req, res) => {
  const skus = getDb().prepare(`SELECT s.*, st.quantity_physical, st.quantity_reserved, st.quantity_available FROM skus s LEFT JOIN stock st ON s.id=st.sku_id WHERE s.active=1 ORDER BY s.name`).all();
  res.json(skus);
});

router.get('/stock-movements', (req, res) => {
  const { date_from, date_to, sku_id } = req.query;
  const params = [];
  let q = `SELECT sm.*, s.name as sku_name, s.code, u.name as operator_name FROM stock_movements sm LEFT JOIN skus s ON sm.sku_id=s.id LEFT JOIN users u ON sm.operator_id=u.id WHERE 1=1`;
  if (sku_id) { q += ' AND sm.sku_id=?'; params.push(sku_id); }
  if (date_from) { q += ' AND DATE(sm.created_at)>=?'; params.push(date_from); }
  if (date_to) { q += ' AND DATE(sm.created_at)<=?'; params.push(date_to); }
  q += ' ORDER BY sm.created_at DESC LIMIT 500';
  res.json(getDb().prepare(q).all(...params));
});

router.get('/loss-reasons', (req, res) => {
  const { date_from, date_to, seller_id } = req.query;
  const params = [];
  let q = `SELECT v.no_order_reason, COUNT(*) as count, u.name as seller_name FROM visits v LEFT JOIN users u ON v.seller_id=u.id WHERE v.took_order=0 AND v.no_order_reason IS NOT NULL`;
  if (seller_id) { q += ' AND v.seller_id=?'; params.push(seller_id); }
  if (date_from) { q += ' AND v.visit_date>=?'; params.push(date_from); }
  if (date_to) { q += ' AND v.visit_date<=?'; params.push(date_to); }
  q += ' GROUP BY v.no_order_reason ORDER BY count DESC';
  res.json(getDb().prepare(q).all(...params));
});

router.get('/tubes', (req, res) => {
  const { date_from, date_to, driver_id } = req.query;
  const params = [];
  let q = `SELECT d.*, c.name as client_name, u.name as driver_name FROM deliveries d LEFT JOIN orders o ON d.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON d.driver_id=u.id WHERE d.tubes_collected=1`;
  if (driver_id) { q += ' AND d.driver_id=?'; params.push(driver_id); }
  if (date_from) { q += ' AND DATE(d.updated_at)>=?'; params.push(date_from); }
  if (date_to) { q += ' AND DATE(d.updated_at)<=?'; params.push(date_to); }
  q += ' ORDER BY d.updated_at DESC';
  res.json(getDb().prepare(q).all(...params));
});

router.get('/canhotos', (req, res) => {
  const { date_from, date_to, driver_id } = req.query;
  const params = [];
  let q = `SELECT d.*, c.name as client_name, u.name as driver_name FROM deliveries d LEFT JOIN orders o ON d.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON d.driver_id=u.id WHERE d.canhoto_photo IS NOT NULL`;
  if (driver_id) { q += ' AND d.driver_id=?'; params.push(driver_id); }
  if (date_from) { q += ' AND DATE(d.updated_at)>=?'; params.push(date_from); }
  if (date_to) { q += ' AND DATE(d.updated_at)<=?'; params.push(date_to); }
  q += ' ORDER BY d.updated_at DESC';
  res.json(getDb().prepare(q).all(...params));
});

router.get('/next-purchases', (req, res) => {
  const { seller_id, days } = req.query;
  const params = [];
  const today = new Date().toISOString().split('T')[0];
  const limit = new Date(Date.now() + (parseInt(days) || 30) * 86400000).toISOString().split('T')[0];
  let q = `SELECT v.next_purchase_date, c.name as client_name, c.phone, c.city, u.name as seller_name FROM visits v LEFT JOIN clients c ON v.client_id=c.id LEFT JOIN users u ON v.seller_id=u.id WHERE v.next_purchase_date BETWEEN ? AND ?`;
  params.push(today, limit);
  if (seller_id) { q += ' AND v.seller_id=?'; params.push(seller_id); }
  q += ' ORDER BY v.next_purchase_date ASC';
  res.json(getDb().prepare(q).all(...params));
});

module.exports = router;
