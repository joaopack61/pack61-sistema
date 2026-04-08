'use strict';
const express = require('express');
const { query, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /clients
router.get('/', authorize('admin','vendedor'), async (req, res) => {
  try {
    let sql = `SELECT c.*, u.name as seller_name FROM clients c LEFT JOIN users u ON c.seller_id=u.id WHERE c.active=true AND c.ativo=true`;
    const params = [];
    let i = 1;
    if (req.user.role === 'vendedor') { sql += ` AND c.seller_id=$${i++}`; params.push(req.user.id); }
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      sql += ` AND (c.name ILIKE $${i} OR c.razao_social ILIKE $${i} OR c.city ILIKE $${i} OR c.cidade ILIKE $${i} OR c.cnpj ILIKE $${i})`;
      params.push(s); i++;
    }
    if (req.query.status) { sql += ` AND c.status=$${i++}`; params.push(req.query.status); }
    if (req.query.tipo)   { sql += ` AND c.tipo_cliente=$${i++}`; params.push(req.query.tipo); }
    sql += ' ORDER BY c.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /clients/:id
router.get('/:id', authorize('admin','vendedor'), async (req, res) => {
  try {
    const result = await query('SELECT c.*, u.name as seller_name FROM clients c LEFT JOIN users u ON c.seller_id=u.id WHERE c.id=$1', [req.params.id]);
    const client = result.rows[0];
    if (!client) return res.status(404).json({ error: true, message: 'Cliente não encontrado' });
    if (req.user.role === 'vendedor' && client.seller_id !== req.user.id) return res.status(403).json({ error: true, message: 'Acesso negado' });
    res.json(client);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// POST /clients
router.post('/', authorize('admin','vendedor'), async (req, res) => {
  try {
    const { name, razao_social, nome_fantasia, cnpj, address, city, estado, cep, phone, whatsapp, email, contato_nome, contato_telefone, tipo_cliente, notes } = req.body;
    const clientName = name || razao_social;
    if (!clientName) return res.status(400).json({ error: true, message: 'Nome/Razão Social obrigatório' });
    const seller_id = req.user.role === 'vendedor' ? req.user.id : (req.body.seller_id || null);
    const result = await query(
      `INSERT INTO clients (name, razao_social, nome_fantasia, cnpj, address, endereco, city, cidade, estado, cep, phone, whatsapp, email, contato_nome, contato_telefone, tipo_cliente, seller_id, notes, status, active, ativo, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'ATIVO',true,true,now(),now()) RETURNING id`,
      [clientName, razao_social || clientName, nome_fantasia || null, cnpj || null, address || null, city || null, estado || null, cep || null, phone || null, whatsapp || null, email || null, contato_nome || null, contato_telefone || null, tipo_cliente || 'OUTROS', seller_id, notes || null]
    );
    await auditLog(req.user.id, 'client_created', 'clients', result.rows[0].id, null, { name: clientName });
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PUT /clients/:id
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, razao_social, cnpj, address, city, estado, cep, phone, whatsapp, email, contato_nome, contato_telefone, tipo_cliente, limite_credito, notes } = req.body;
    await query(
      `UPDATE clients SET name=COALESCE($1,name), razao_social=COALESCE($2,razao_social), cnpj=COALESCE($3,cnpj), address=COALESCE($4,address), city=COALESCE($5,city), cidade=COALESCE($5,cidade), estado=COALESCE($6,estado), cep=COALESCE($7,cep), phone=COALESCE($8,phone), email=COALESCE($9,email), contato_nome=COALESCE($10,contato_nome), contato_telefone=COALESCE($11,contato_telefone), tipo_cliente=COALESCE($12,tipo_cliente), limite_credito=COALESCE($13,limite_credito), notes=COALESCE($14,notes), updated_at=now() WHERE id=$15`,
      [name||null, razao_social||null, cnpj||null, address||null, city||null, estado||null, cep||null, phone||null, email||null, contato_nome||null, contato_telefone||null, tipo_cliente||null, limite_credito||null, notes||null, req.params.id]
    );
    await auditLog(req.user.id, 'client_updated', 'clients', req.params.id, null, req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PUT /clients/:id/block
router.put('/:id/block', authorize('admin'), async (req, res) => {
  try {
    const { motivo } = req.body;
    await query(`UPDATE clients SET status='BLOQUEADO', bloqueio_motivo=$1, updated_at=now() WHERE id=$2`, [motivo || 'Bloqueado pelo administrador', req.params.id]);
    await auditLog(req.user.id, 'client_blocked', 'clients', req.params.id, null, { motivo });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// PUT /clients/:id/unblock
router.put('/:id/unblock', authorize('admin'), async (req, res) => {
  try {
    await query(`UPDATE clients SET status='ATIVO', bloqueio_motivo=NULL, updated_at=now() WHERE id=$1`, [req.params.id]);
    await auditLog(req.user.id, 'client_unblocked', 'clients', req.params.id, null, {});
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /clients/:id/orders
router.get('/:id/orders', authorize('admin'), async (req, res) => {
  try {
    const result = await query('SELECT o.*, u.name as seller_name FROM orders o LEFT JOIN users u ON o.seller_id=u.id WHERE o.client_id=$1 ORDER BY o.created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// GET /clients/:id/payments
router.get('/:id/payments', authorize('admin'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM payments WHERE client_id=$1 ORDER BY data_vencimento DESC', [req.params.id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// DELETE /clients/:id (soft)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('UPDATE clients SET active=false, ativo=false, updated_at=now() WHERE id=$1', [req.params.id]);
    await auditLog(req.user.id, 'client_deleted', 'clients', req.params.id, null, {});
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
