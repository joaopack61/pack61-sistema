const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin'), (req, res) => {
  const users = getDb().prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY name').all();
  res.json(users);
});

router.post('/', authorize('admin'), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Todos os campos sao obrigatorios' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = getDb().prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run(name, email.toLowerCase().trim(), hash, role);
    res.status(201).json({ id: result.lastInsertRowid, name, email, role });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email ja cadastrado' });
    throw e;
  }
});

router.put('/:id', authorize('admin'), (req, res) => {
  const { name, email, role, active, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

  let newHash = user.password_hash;
  if (password) newHash = bcrypt.hashSync(password, 10);

  db.prepare('UPDATE users SET name=?, email=?, role=?, active=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name || user.name, email || user.email, role || user.role, active !== undefined ? active : user.active, newHash, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', authorize('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Nao pode excluir a si mesmo' });
  getDb().prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
