'use strict';
const jwt = require('jsonwebtoken');
const { query } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'pack61_secret_2024_muito_seguro';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES_DAYS = 7;

function generateAccessToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, message: 'Token não fornecido', code: 'NO_TOKEN' });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await query('SELECT id, name, email, role, active FROM users WHERE id = $1', [payload.id]);
    const user = result.rows[0];
    if (!user || !user.active) return res.status(401).json({ error: true, message: 'Usuário inválido ou inativo', code: 'INVALID_USER' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: true, message: 'Token inválido ou expirado', code: 'TOKEN_EXPIRED' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: true, message: 'Acesso negado para este perfil', code: 'FORBIDDEN' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, JWT_SECRET, generateAccessToken, REFRESH_EXPIRES_DAYS };
