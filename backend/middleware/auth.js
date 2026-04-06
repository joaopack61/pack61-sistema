const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'pack61_secret_2024_muito_seguro';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getDb().prepare('SELECT id, name, email, role, active FROM users WHERE id = ?').get(payload.id);
    if (!user || !user.active) return res.status(401).json({ error: 'Usuario invalido ou inativo' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado para este perfil' });
    }
    next();
  };
}

function auditLog(action, table, recordId, details) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        try {
          getDb().prepare(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, details) VALUES (?,?,?,?,?)'
          ).run(req.user?.id, action, table, recordId, JSON.stringify(details));
        } catch {}
      }
    });
    next();
  };
}

module.exports = { authenticate, authorize, JWT_SECRET };
