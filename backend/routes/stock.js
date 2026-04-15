'use strict';
const express = require('express');
const { query, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin','producao'));

// ─── SKUs ─────────────────────────────────────────────────────────────────────

router.get('/skus', async (req, res) => {
  try {
    let sql = `
      SELECT s.*, st.quantity_physical, st.quantity_reserved, st.quantity_available,
        CASE WHEN st.quantity_available <= s.min_stock THEN true ELSE false END as is_low_stock
      FROM skus s LEFT JOIN stock st ON s.id=st.sku_id
      WHERE s.active=true`;
    const params = [];
    let i = 1;
    if (req.query.category) { sql += ` AND s.category=$${i++}`; params.push(req.query.category); }
    if (req.query.low_stock === '1') sql += ' AND st.quantity_available <= s.min_stock';
    sql += ' ORDER BY s.category, s.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

router.get('/skus/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*, st.quantity_physical, st.quantity_reserved, st.quantity_available
      FROM skus s LEFT JOIN stock st ON s.id=st.sku_id WHERE s.id=$1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: true, message: 'SKU não encontrado' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

router.post('/skus', async (req, res) => {
  try {
    const { code, name, category, type, weight, unit, min_stock, description } = req.body;
    if (!name) return res.status(400).json({ error: true, message: 'Nome é obrigatório' });
    const result = await query(
      'INSERT INTO skus (code,name,category,type,weight,unit,min_stock,description,active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,now(),now()) RETURNING id',
      [code || null, name, category || null, type || null, weight || null, unit || 'UN', min_stock || 0, description || null]
    );
    const skuId = result.rows[0].id;
    await query('INSERT INTO stock (sku_id,quantity_physical,quantity_reserved,quantity_available) VALUES ($1,0,0,0)', [skuId]);
    await auditLog(req.user.id, 'sku_created', 'skus', skuId, null, { code, name });
    res.status(201).json({ id: skuId });
  } catch (e) {
    if (e.message && e.message.includes('unique')) return res.status(400).json({ error: true, message: 'Código já cadastrado' });
    res.status(500).json({ error: true, message: e.message });
  }
});

router.put('/skus/:id', async (req, res) => {
  try {
    const { name, category, type, weight, unit, min_stock, description, active } = req.body;
    await query(
      'UPDATE skus SET name=$1,category=$2,type=$3,weight=$4,unit=$5,min_stock=$6,description=$7,active=$8,updated_at=now() WHERE id=$9',
      [name, category, type, weight, unit, min_stock, description, active !== false ? true : false, req.params.id]
    );
    await auditLog(req.user.id, 'sku_updated', 'skus', parseInt(req.params.id), null, { name, min_stock });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ─── RESUMO DE ESTOQUE ────────────────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.id, s.code, s.name, s.category, s.unit, s.min_stock,
        COALESCE(st.quantity_physical, 0) as physical,
        COALESCE(st.quantity_reserved, 0) as reserved,
        COALESCE(st.quantity_available, 0) as available,
        CASE
          WHEN COALESCE(st.quantity_available, 0) <= 0 THEN 'critico'
          WHEN COALESCE(st.quantity_available, 0) <= s.min_stock THEN 'baixo'
          ELSE 'ok'
        END as stock_status,
        CASE WHEN COALESCE(st.quantity_physical, 0) > 0
          THEN ROUND(COALESCE(st.quantity_reserved, 0) * 100.0 / COALESCE(st.quantity_physical, 0), 1)
          ELSE 0
        END as reserved_pct
      FROM skus s LEFT JOIN stock st ON s.id=st.sku_id
      WHERE s.active=true ORDER BY s.category, s.name
    `);
    const skus = result.rows;
    const totals = {
      total_physical:  skus.reduce((a, s) => a + parseInt(s.physical || 0), 0),
      total_reserved:  skus.reduce((a, s) => a + parseInt(s.reserved || 0), 0),
      total_available: skus.reduce((a, s) => a + parseInt(s.available || 0), 0),
      sku_count:       skus.length,
      low_count:       skus.filter(s => s.stock_status === 'baixo').length,
      critical_count:  skus.filter(s => s.stock_status === 'critico').length,
    };
    res.json({ totals, skus });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ─── RESERVAS POR PEDIDO PARA UM SKU ─────────────────────────────────────────

router.get('/reservations/:sku_id', async (req, res) => {
  try {
    const result = await query(`
      SELECT oi.quantity, o.id as order_id, o.status as order_status,
        o.delivery_date, c.name as client_name, u.name as seller_name
      FROM order_items oi
      JOIN orders o ON oi.order_id=o.id
      LEFT JOIN clients c ON o.client_id=c.id
      LEFT JOIN users u ON o.seller_id=u.id
      WHERE oi.sku_id=$1 AND o.status NOT IN ('entregue','cancelado')
      ORDER BY o.delivery_date ASC
    `, [req.params.sku_id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ─── ALERTAS ─────────────────────────────────────────────────────────────────

router.get('/alerts', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.id, s.code, s.name, s.category, s.unit, s.min_stock,
        COALESCE(st.quantity_physical, 0) as physical,
        COALESCE(st.quantity_reserved, 0) as reserved,
        COALESCE(st.quantity_available, 0) as available
      FROM skus s LEFT JOIN stock st ON s.id=st.sku_id
      WHERE s.active=true AND COALESCE(st.quantity_available, 0) <= s.min_stock
      ORDER BY st.quantity_available ASC
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ─── MOVIMENTAÇÕES ────────────────────────────────────────────────────────────

router.get('/movements', async (req, res) => {
  try {
    let sql = `
      SELECT sm.*, s.name as sku_name, s.code, s.unit,
        u.name as operator_name
      FROM stock_movements sm
      LEFT JOIN skus s ON sm.sku_id=s.id
      LEFT JOIN users u ON sm.operator_id=u.id
      WHERE 1=1`;
    const params = [];
    let i = 1;
    if (req.query.sku_id)   { sql += ` AND sm.sku_id=$${i++}`;              params.push(req.query.sku_id); }
    if (req.query.type)     { sql += ` AND sm.type=$${i++}`;                 params.push(req.query.type); }
    if (req.query.date_from){ sql += ` AND DATE(sm.created_at)>=$${i++}`;   params.push(req.query.date_from); }
    if (req.query.date_to)  { sql += ` AND DATE(sm.created_at)<=$${i++}`;   params.push(req.query.date_to); }
    sql += ' ORDER BY sm.created_at DESC LIMIT 300';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

router.post('/movements', async (req, res) => {
  try {
    const { sku_id, type, quantity, reason } = req.body;
    const VALID_TYPES = ['entrada','saida','ajuste','perda','avaria','producao'];
    if (!sku_id || !type || !quantity) return res.status(400).json({ error: true, message: 'SKU, tipo e quantidade são obrigatórios' });
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: true, message: 'Tipo de movimentação inválido' });

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: true, message: 'Quantidade deve ser positiva' });

    const stockRes = await query('SELECT * FROM stock WHERE sku_id=$1', [sku_id]);
    const stock = stockRes.rows[0];
    if (!stock) return res.status(404).json({ error: true, message: 'Estoque não encontrado para este SKU' });

    await query('INSERT INTO stock_movements (sku_id,type,quantity,reason,operator_id,created_at) VALUES ($1,$2,$3,$4,$5,now())',
      [sku_id, type, qty, reason, req.user.id]);

    let physical = parseInt(stock.quantity_physical) || 0;
    if (['entrada','producao'].includes(type)) physical += qty;
    else if (['saida','perda','avaria'].includes(type)) physical -= qty;
    else if (type === 'ajuste') physical = qty;

    physical = Math.max(0, physical);
    const available = Math.max(0, physical - (parseInt(stock.quantity_reserved) || 0));

    await query('UPDATE stock SET quantity_physical=$1,quantity_available=$2,updated_at=now() WHERE sku_id=$3', [physical, available, sku_id]);
    await auditLog(req.user.id, 'stock_movement', 'stock_movements', null, null, { sku_id, type, quantity: qty, reason });
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// ─── INVENTÁRIO (ajuste em lote) ─────────────────────────────────────────────

router.post('/inventory', async (req, res) => {
  try {
    const { items, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: true, message: 'Lista de itens obrigatória' });

    for (const { sku_id, quantity } of items) {
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty < 0) continue;
      const stockRes = await query('SELECT * FROM stock WHERE sku_id=$1', [sku_id]);
      const stock = stockRes.rows[0];
      if (!stock) continue;

      await query('INSERT INTO stock_movements (sku_id,type,quantity,reason,operator_id,created_at) VALUES ($1,$2,$3,$4,$5,now())',
        [sku_id, 'ajuste', qty, notes || 'Inventário manual', req.user.id]);

      const available = Math.max(0, qty - (parseInt(stock.quantity_reserved) || 0));
      await query('UPDATE stock SET quantity_physical=$1,quantity_available=$2,updated_at=now() WHERE sku_id=$3', [qty, available, sku_id]);
    }

    await auditLog(req.user.id, 'inventory_done', 'stock', null, null, { count: items.length, notes });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
