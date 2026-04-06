const { auditLog } = require('../database');

// Middleware que injeta auditLog no request e registra mutações automaticamente
function withAudit(req, res, next) {
  req.audit = (action, tableName, recordId, details = {}) => {
    auditLog(req.user?.id, action, tableName, recordId, details);
  };
  next();
}

// Middleware de log automático para respostas de sucesso
function autoAudit(action, tableName) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode < 400 && req.user) {
        const recordId = data?.id || req.params?.id || null;
        auditLog(req.user.id, action, tableName, recordId ? parseInt(recordId) : null, {
          method: req.method,
          path: req.path,
          body: sanitizeBody(req.body),
        });
      }
      return originalJson(data);
    };
    next();
  };
}

// Remove dados sensíveis antes de logar
function sanitizeBody(body = {}) {
  const { password, password_hash, ...safe } = body;
  return safe;
}

// Registra login no audit_logs
function logLogin(db, userId, ip) {
  auditLog(userId, 'login', 'users', userId, { ip: ip || 'unknown' });
  db.prepare('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?').run(userId);
}

module.exports = { withAudit, autoAudit, logLogin, auditLog };
