'use strict';
const express = require('express');
const { query } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /reports/visits
router.get('/visits', async (req, res) => {
  try {
    const { date_from, date_to, seller_id, city } = req.query;
    let sql = `SELECT v.*, c.name as client_name, c.city, c.cidade, u.name as seller_name
               FROM visits v LEFT JOIN clients c ON v.client_id=c.id LEFT JOIN users u ON v.seller_id=u.id WHERE 1=1`;
    const params = [];
    let i = 1;
    if (seller_id) { sql += ` AND v.seller_id=$${i++}`; params.push(seller_id); }
    if (city)      { sql += ` AND (c.city ILIKE $${i} OR c.cidade ILIKE $${i})`; params.push(`%${city}%`); i++; }
    if (date_from) { sql += ` AND COALESCE(v.data_visita, v.visit_date)>=$${i++}`; params.push(date_from); }
    if (date_to)   { sql += ` AND COALESCE(v.data_visita, v.visit_date)<=$${i++}`; params.push(date_to); }
    sql += ' ORDER BY COALESCE(v.data_visita, v.visit_date) DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /reports/orders
router.get('/orders', async (req, res) => {
  try {
    const { date_from, date_to, seller_id, status, client_id } = req.query;
    let sql = `SELECT o.*, c.name as client_name, c.city, c.cidade, u.name as seller_name
               FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.seller_id=u.id WHERE 1=1`;
    const params = [];
    let i = 1;
    if (seller_id)  { sql += ` AND o.seller_id=$${i++}`;          params.push(seller_id); }
    if (status)     { sql += ` AND o.status=$${i++}`;              params.push(status); }
    if (client_id)  { sql += ` AND o.client_id=$${i++}`;           params.push(client_id); }
    if (date_from)  { sql += ` AND DATE(o.created_at)>=$${i++}`;   params.push(date_from); }
    if (date_to)    { sql += ` AND DATE(o.created_at)<=$${i++}`;   params.push(date_to); }
    sql += ' ORDER BY o.created_at DESC';
    const result = await query(sql, params);
    const orders = result.rows;
    for (const o of orders) {
      const items = await query(
        `SELECT oi.*, COALESCE(p.nome, s.name) as sku_name FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=$1`,
        [o.id]
      );
      o.items = items.rows;
    }
    res.json(orders);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /reports/deliveries
router.get('/deliveries', async (req, res) => {
  try {
    const { date_from, date_to, driver_id, status } = req.query;
    let sql = `SELECT d.*, c.name as client_name, c.city, c.cidade, u.name as driver_name, v.plate
               FROM deliveries d
               LEFT JOIN orders o ON d.order_id=o.id
               LEFT JOIN clients c ON o.client_id=c.id
               LEFT JOIN users u ON d.driver_id=u.id
               LEFT JOIN vehicles v ON d.vehicle_id=v.id
               WHERE 1=1`;
    const params = [];
    let i = 1;
    if (driver_id) { sql += ` AND d.driver_id=$${i++}`; params.push(driver_id); }
    if (status)    { sql += ` AND d.status=$${i++}`;     params.push(status); }
    if (date_from) { sql += ` AND DATE(d.created_at)>=$${i++}`; params.push(date_from); }
    if (date_to)   { sql += ` AND DATE(d.created_at)<=$${i++}`; params.push(date_to); }
    sql += ' ORDER BY d.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /reports/stock
router.get('/stock', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, st.quantity_physical, st.quantity_reserved, st.quantity_available
       FROM skus s LEFT JOIN stock st ON s.id=st.sku_id WHERE s.active=true ORDER BY s.name`
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /reports/stock-movements
router.get('/stock-movements', async (req, res) => {
  try {
    const { date_from, date_to, sku_id } = req.query;
    let sql = `SELECT sm.*, s.name as sku_name, s.code, u.name as operator_name
               FROM stock_movements sm LEFT JOIN skus s ON sm.sku_id=s.id LEFT JOIN users u ON sm.operator_id=u.id WHERE 1=1`;
    const params = [];
    let i = 1;
    if (sku_id)    { sql += ` AND sm.sku_id=$${i++}`;             params.push(sku_id); }
    if (date_from) { sql += ` AND DATE(sm.created_at)>=$${i++}`;  params.push(date_from); }
    if (date_to)   { sql += ` AND DATE(sm.created_at)<=$${i++}`;  params.push(date_to); }
    sql += ' ORDER BY sm.created_at DESC LIMIT 500';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /reports/loss-reasons
router.get('/loss-reasons', async (req, res) => {
  try {
    const { date_from, date_to, seller_id } = req.query;
    let sql = `SELECT v.loss_reason, COUNT(*) as count, u.name as seller_name
               FROM visits v LEFT JOIN users u ON v.seller_id=u.id
               WHERE v.result='PERDIDO' AND v.loss_reason IS NOT NULL`;
    const params = [];
    let i = 1;
    if (seller_id) { sql += ` AND v.seller_id=$${i++}`; params.push(seller_id); }
    if (date_from) { sql += ` AND COALESCE(v.data_visita, v.visit_date)>=$${i++}`; params.push(date_from); }
    if (date_to)   { sql += ` AND COALESCE(v.data_visita, v.visit_date)<=$${i++}`; params.push(date_to); }
    sql += ' GROUP BY v.loss_reason, u.name ORDER BY count DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /reports/tubes
router.get('/tubes', async (req, res) => {
  try {
    const { date_from, date_to, driver_id } = req.query;
    let sql = `SELECT d.*, c.name as client_name, u.name as driver_name
               FROM deliveries d
               LEFT JOIN orders o ON d.order_id=o.id
               LEFT JOIN clients c ON o.client_id=c.id
               LEFT JOIN users u ON d.driver_id=u.id
               WHERE d.tubes_had=true`;
    const params = [];
    let i = 1;
    if (driver_id) { sql += ` AND d.driver_id=$${i++}`; params.push(driver_id); }
    if (date_from) { sql += ` AND DATE(d.updated_at)>=$${i++}`; params.push(date_from); }
    if (date_to)   { sql += ` AND DATE(d.updated_at)<=$${i++}`; params.push(date_to); }
    sql += ' ORDER BY d.updated_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /reports/canhotos
router.get('/canhotos', async (req, res) => {
  try {
    const { date_from, date_to, driver_id } = req.query;
    let sql = `SELECT d.*, c.name as client_name, u.name as driver_name
               FROM deliveries d
               LEFT JOIN orders o ON d.order_id=o.id
               LEFT JOIN clients c ON o.client_id=c.id
               LEFT JOIN users u ON d.driver_id=u.id
               WHERE d.canhoto_photo IS NOT NULL`;
    const params = [];
    let i = 1;
    if (driver_id) { sql += ` AND d.driver_id=$${i++}`; params.push(driver_id); }
    if (date_from) { sql += ` AND DATE(d.updated_at)>=$${i++}`; params.push(date_from); }
    if (date_to)   { sql += ` AND DATE(d.updated_at)<=$${i++}`; params.push(date_to); }
    sql += ' ORDER BY d.updated_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /reports/next-purchases
router.get('/next-purchases', async (req, res) => {
  try {
    const { seller_id, days } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const limit = new Date(Date.now() + (parseInt(days) || 30) * 86400000).toISOString().split('T')[0];
    let sql = `SELECT v.next_contact_date, c.name as client_name, c.phone, c.city, c.cidade, u.name as seller_name
               FROM visits v LEFT JOIN clients c ON v.client_id=c.id LEFT JOIN users u ON v.seller_id=u.id
               WHERE v.next_contact_date BETWEEN $1 AND $2`;
    const params = [today, limit];
    let i = 3;
    if (seller_id) { sql += ` AND v.seller_id=$${i++}`; params.push(seller_id); }
    sql += ' ORDER BY v.next_contact_date ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
