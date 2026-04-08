'use strict';
const express = require('express');
const { query, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products WHERE ativo=true AND active=true ORDER BY nome');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: true, message: 'Produto não encontrado' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { nome, tipo, gramatura, metragem, largura, descricao, preco_unitario, unidade } = req.body;
    if (!nome) return res.status(400).json({ error: true, message: 'Nome obrigatório' });
    const result = await query(
      'INSERT INTO products (nome, name, tipo, gramatura, metragem, largura, descricao, preco_unitario, unit_price, unidade, ativo, active) VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$7,$8,true,true) RETURNING id',
      [nome, tipo||'STRETCH', gramatura||null, metragem||null, largura||null, descricao||null, preco_unitario||0, unidade||'ROLO']
    );
    await auditLog(req.user.id, 'product_created', 'products', result.rows[0].id, null, { nome });
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { nome, tipo, gramatura, metragem, largura, descricao, preco_unitario, unidade } = req.body;
    const before = await query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    await query(
      `UPDATE products SET nome=COALESCE($1,nome), name=COALESCE($1,name), tipo=COALESCE($2,tipo), gramatura=COALESCE($3,gramatura), metragem=COALESCE($4,metragem), largura=COALESCE($5,largura), descricao=COALESCE($6,descricao), preco_unitario=COALESCE($7,preco_unitario), unit_price=COALESCE($7,unit_price), unidade=COALESCE($8,unidade), updated_at=now() WHERE id=$9`,
      [nome||null, tipo||null, gramatura||null, metragem||null, largura||null, descricao||null, preco_unitario||null, unidade||null, req.params.id]
    );
    await auditLog(req.user.id, 'product_updated', 'products', req.params.id, before.rows[0], req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const before = await query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    await query('UPDATE products SET ativo=false, active=false, updated_at=now() WHERE id=$1', [req.params.id]);
    await auditLog(req.user.id, 'product_deleted', 'products', req.params.id, before.rows[0], { ativo: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
