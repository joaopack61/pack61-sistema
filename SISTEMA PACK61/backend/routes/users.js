'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { query, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /users
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, role, active, phone, created_at FROM users ORDER BY name');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// POST /users
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: true, message: 'Todos os campos são obrigatórios' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, role, phone, active, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,true,now(),now()) RETURNING id',
      [name, email.toLowerCase().trim(), hash, role, phone || null]
    );
    await auditLog(req.user.id, 'user_created', 'users', result.rows[0].id, null, { name, email, role });
    res.status(201).json({ id: result.rows[0].id, name, email, role });
  } catch (e) {
    if (e.message && e.message.includes('unique')) return res.status(400).json({ error: true, message: 'E-mail já cadastrado' });
    res.status(500).json({ error: true, message: e.message });
  }
});

// PUT /users/:id
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, email, role, active, password, phone } = req.body;
    const userRes = await query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: true, message: 'Usuário não encontrado' });

    let newHash = user.password_hash;
    if (password) newHash = bcrypt.hashSync(password, 10);

    await query(
      'UPDATE users SET name=$1, email=$2, role=$3, active=$4, password_hash=$5, phone=$6, updated_at=now() WHERE id=$7',
      [name || user.name, email || user.email, role || user.role, active !== undefined ? active : user.active, newHash, phone || user.phone, req.params.id]
    );
    await auditLog(req.user.id, 'user_updated', 'users', req.params.id, null, { name, role, active });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

// DELETE /users/:id (soft)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: true, message: 'Não pode excluir a si mesmo' });
    await query('UPDATE users SET active=false, updated_at=now() WHERE id=$1', [req.params.id]);
    await auditLog(req.user.id, 'user_deleted', 'users', req.params.id, null, {});
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: true, message: e.message }); }
});

module.exports = router;
