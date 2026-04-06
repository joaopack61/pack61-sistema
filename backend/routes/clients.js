const express = require('express');
const { getDb, auditLog } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDb();
  let query = `SELECT c.*, u.name as seller_name FROM clients c LEFT JOIN users u ON c.seller_id = u.id WHERE c.active = 1`;
  const params = [];

  if (req.user.role === 'vendedor') { query += ' AND c.seller_id = ?'; params.push(req.user.id); }
  if (req.query.search) {
    query += ` AND (c.name LIKE ? OR c.company_name LIKE ? OR c.city LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ?)`;
    const s = `%${req.query.search}%`;
    params.push(s, s, s, s, s);
  }
  if (req.query.city)    { query += ' AND c.city = ?';    params.push(req.query.city); }
  if (req.query.segment) { query += ' AND c.segment = ?'; params.push(req.query.segment); }

  query += ' ORDER BY c.name';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const client = getDb().prepare(`SELECT c.*, u.name as seller_name FROM clients c LEFT JOIN users u ON c.seller_id = u.id WHERE c.id = ?`).get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  if (req.user.role === 'vendedor' && client.seller_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
  res.json(client);
});

router.post('/', authorize('admin', 'vendedor'), (req, res) => {
  const { name, company_name, cnpj, address, city, region, state, cep, phone, whatsapp, email, segment, responsible, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  const seller_id = req.user.role === 'vendedor' ? req.user.id : (req.body.seller_id || req.user.id);
  const result = getDb().prepare(
    `INSERT INTO clients (name,company_name,cnpj,address,city,region,state,cep,phone,whatsapp,email,segment,responsible,seller_id,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(name, company_name, cnpj, address, city, region, state, cep, phone, whatsapp, email, segment, responsible, seller_id, notes);
  auditLog(req.user.id, 'client_created', 'clients', result.lastInsertRowid, { name, city });
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', authorize('admin', 'vendedor'), (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  if (req.user.role === 'vendedor' && client.seller_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

  const { name, company_name, cnpj, address, city, region, state, cep, phone, whatsapp, email, segment, responsible, notes } = req.body;
  db.prepare(
    `UPDATE clients SET name=?,company_name=?,cnpj=?,address=?,city=?,region=?,state=?,cep=?,phone=?,whatsapp=?,email=?,segment=?,responsible=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(
    name || client.name, company_name || client.company_name, cnpj || client.cnpj,
    address || client.address, city || client.city, region || client.region,
    state || client.state, cep || client.cep, phone || client.phone,
    whatsapp !== undefined ? whatsapp : client.whatsapp,
    email || client.email, segment || client.segment, responsible || client.responsible,
    notes || client.notes, req.params.id
  );
  auditLog(req.user.id, 'client_updated', 'clients', parseInt(req.params.id), { name });
  res.json({ success: true });
});

router.delete('/:id', authorize('admin'), (req, res) => {
  getDb().prepare('UPDATE clients SET active = 0 WHERE id = ?').run(req.params.id);
  auditLog(req.user.id, 'client_deleted', 'clients', parseInt(req.params.id), {});
  res.json({ success: true });
});

module.exports = router;
