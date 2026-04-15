'use strict';
const { auditLog } = require('../database');

// Middleware que injeta auditLog no request
function withAudit(req, res, next) {
  req.audit = (action, tableName, recordId, details = {}) => {
    auditLog(req.user?.id, action, tableName, recordId, null, details);
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
        auditLog(req.user.id, action, tableName, recordId ? parseInt(recordId) : null, null, {
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

module.exports = { withAudit, autoAudit, auditLog };
