'use strict';
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { query, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const orderService = require('../services/orderService');

const router = express.Router();
router.use(authenticate);

const uploadsDir = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ storage: multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `ord_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
}), limits: { fileSize: 15 * 1024 * 1024 } });

// SSE Stream
router.get('/delivery/stream', authorize('admin','motorista'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(':ok\n\n');
  orderService.addSseClient(res);
});

// GET /orders/delivery
router.get('/delivery', authorize('admin','motorista'), async (req, res) => {
  try {
    const ds = req.query.status || 'DISPONIVEL';
    const result = await query(`
      SELECT o.id, o.delivery_status, o.total_value, o.valor_total, o.updated_at,
        c.name as client_name, c.razao_social, c.address, c.endereco, c.city, c.cidade, c.phone, c.contato_telefone,
        u.name as driver_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id=c.id
      LEFT JOIN users u ON o.driver_id=u.id
      WHERE o.delivery_status=$1
      ORDER BY o.updated_at DESC LIMIT 100
    `, [ds]);
    const orders = result.rows;
    for (const o of orders) {
      const items = await query('SELECT oi.*, p.nome as sku_name, p.nome as product_name FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id WHERE oi.order_id=$1', [o.id]);
      o.items = items.rows;
    }
    res.json(orders);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /orders
router.get('/', async (req, res) => {
  try {
    let sql = `SELECT o.*, c.name as client_name, c.razao_social, c.city, c.cidade, c.phone, u.name as seller_name
               FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.seller_id=u.id WHERE 1=1`;
    const params = [];
    let i = 1;
    if (req.user.role === 'vendedor') { sql += ` AND o.seller_id=$${i++}`; params.push(req.user.id); }
    if (req.user.role === 'producao') { sql += ` AND o.status IN ('pendente','em_producao','produzido')`; }
    if (req.query.status) { sql += ` AND o.status=$${i++}`; params.push(req.query.status); }
    if (req.query.client_id) { sql += ` AND o.client_id=$${i++}`; params.push(req.query.client_id); }
    if (req.query.date_from) { sql += ` AND DATE(o.created_at)>=$${i++}`; params.push(req.query.date_from); }
    if (req.query.date_to) { sql += ` AND DATE(o.created_at)<=$${i++}`; params.push(req.query.date_to); }
    sql += ' ORDER BY o.created_at DESC LIMIT 200';
    const result = await query(sql, params);
    const orders = result.rows;
    for (const o of orders) {
      const items = await query('SELECT oi.*, COALESCE(p.nome, s.name) as sku_name FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=$1', [o.id]);
      o.items = items.rows;
    }
    res.json(orders);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /orders/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`SELECT o.*, c.name as client_name, c.razao_social, c.address, c.city, c.phone, c.contato_telefone, u.name as seller_name FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.seller_id=u.id WHERE o.id=$1`, [req.params.id]);
    const order = result.rows[0];
    if (!order) return res.status(404).json({ error: true, message: 'Pedido não encontrado' });
    const items = await query('SELECT oi.*, COALESCE(p.nome, s.name) as sku_name FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id LEFT JOIN skus s ON oi.sku_id=s.id WHERE oi.order_id=$1', [order.id]);
    order.items = items.rows;
    res.json(order);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// POST /orders
router.post('/', authorize('admin','vendedor'), async (req, res) => {
  console.log('[POST /orders] body recebido:', JSON.stringify(req.body, null, 2));
  try {
    const { client_id, items, payment_terms, condicao_pagamento, delivery_date, notes } = req.body;
    if (!client_id || !items?.length) {
      return res.status(400).json({ error: true, message: 'Cliente e itens são obrigatórios' });
    }

    // Verificar bloqueio do cliente
    const clientRes = await query('SELECT status, bloqueio_motivo FROM clients WHERE id=$1', [client_id]);
    const client = clientRes.rows[0];
    if (!client) return res.status(400).json({ error: true, message: 'Cliente não encontrado' });
    if (client.status === 'BLOQUEADO') {
      return res.status(422).json({ error: true, message: `Cliente bloqueado: ${client.bloqueio_motivo || 'contate o administrador'}`, code: 'CLIENT_BLOCKED' });
    }

    const seller_id = req.user.role === 'vendedor' ? req.user.id : (req.body.seller_id || req.user.id);
    const condicao  = condicao_pagamento || payment_terms || 'A_VISTA';
    const origem    = req.user.role === 'admin' ? 'ADMIN' : 'VENDEDOR';
    const total     = items.reduce((acc, it) => {
      const qty   = parseFloat(it.quantity   || it.quantidade   || 0);
      const price = parseFloat(it.unit_price || it.preco_unitario || 0);
      return acc + qty * price;
    }, 0);

    console.log('[POST /orders] inserindo pedido — client_id:', client_id, 'seller_id:', seller_id, 'total:', total);

    const orderRes = await query(
      `INSERT INTO orders
         (client_id, seller_id, origem, status, condicao_pagamento, payment_terms, delivery_date, notes, total_value, valor_total, delivery_status, created_at, updated_at)
       VALUES ($1,$2,$3,'pendente',$4,$5,$6,$7,$8,$8,'AGUARDANDO',now(),now())
       RETURNING id`,
      [client_id, seller_id, origem, condicao, condicao, delivery_date || null, notes || null, total]
    );
    const orderId = orderRes.rows[0].id;
    console.log('[POST /orders] pedido criado id:', orderId);

    for (let idx = 0; idx < items.length; idx++) {
      const it    = items[idx];
      const qty   = parseFloat(it.quantity   || it.quantidade   || 0);
      const price = parseFloat(it.unit_price || it.preco_unitario || 0);
      // product_id referencia tabela products; sku_id referencia tabela skus (legado)
      // Nunca enviar o mesmo id para as duas FKs — são tabelas diferentes
      const productId = it.product_id ? parseInt(it.product_id) : null;
      const skuId     = (!productId && it.sku_id) ? parseInt(it.sku_id) : null;

      console.log(`[POST /orders] item ${idx + 1}: product_id=${productId}, sku_id=${skuId}, qty=${qty}, price=${price}`);

      await query(
        `INSERT INTO order_items
           (order_id, product_id, sku_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, productId, skuId, qty, price, qty * price]
      );
    }

    // Criar ordem de produção (não fatal se falhar)
    try {
      await query("INSERT INTO production_orders (order_id, status) VALUES ($1,'pendente')", [orderId]);
    } catch (prodErr) {
      console.warn('[POST /orders] aviso: não foi possível criar production_order:', prodErr.message);
    }

    await orderService.logStatusHistory(orderId, null, 'pendente', 'status', req.user.id, 'Pedido criado');
    await auditLog(req.user.id, 'order_created', 'orders', orderId, null, { client_id, total });

    console.log('[POST /orders] sucesso, id:', orderId);
    res.status(201).json({ id: orderId });
  } catch (e) {
    console.error('[POST /orders] ERRO:', e.message, e.stack);
    res.status(500).json({ error: true, message: e.message, detail: e.detail || null });
  }
});

// PUT /orders/:id/status
router.put('/:id/status', authorize('admin','producao'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    await orderService.changeStatus(parseInt(req.params.id), status, req.user.id, notes);
    res.json({ success: true });
  } catch (e) { res.status(e.status||500).json({ error: true, message: e.message, code: e.code }); }
});

// PUT /orders/:id/accept
router.put('/:id/accept', authorize('admin','motorista'), async (req, res) => {
  try {
    await orderService.acceptDelivery(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(e.status||500).json({ error: true, message: e.message, code: e.code }); }
});

// PUT /orders/:id/complete
router.put('/:id/complete', authorize('admin','motorista'), upload.single('delivery_photo'), async (req, res) => {
  try {
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const p5 = parseInt(req.body.tubes_p5 || req.body.tubes_qty_p5 || 0);
    const p10 = parseInt(req.body.tubes_p10 || req.body.tubes_qty_p10 || 0);
    await orderService.completeDelivery(parseInt(req.params.id), req.user.id, photoUrl, p5, p10, req.body.notes);
    res.json({ success: true, delivery_proof_url: photoUrl });
  } catch (e) { res.status(e.status||500).json({ error: true, message: e.message, code: e.code }); }
});

// PUT /orders/:id/attempt-failed
router.put('/:id/attempt-failed', authorize('admin','motorista'), async (req, res) => {
  try {
    await orderService.attemptFailed(parseInt(req.params.id), req.user.id, req.body.reason);
    res.json({ success: true });
  } catch (e) { res.status(e.status||500).json({ error: true, message: e.message, code: e.code }); }
});

// PUT /orders/:id/payment
router.put('/:id/payment', authorize('admin'), async (req, res) => {
  try {
    const { payment_status, invoice_number } = req.body;
    await query('UPDATE orders SET payment_status=$1, invoice_number=$2, updated_at=now() WHERE id=$3', [payment_status, invoice_number||null, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
