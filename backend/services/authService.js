'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { generateAccessToken, REFRESH_EXPIRES_DAYS } = require('../middleware/auth');

async function login(email, password) {
  const result = await query('SELECT * FROM users WHERE email = $1 AND active = true', [email.toLowerCase().trim()]);
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw Object.assign(new Error('E-mail ou senha incorretos'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await query(
    'UPDATE users SET refresh_token = $1, refresh_token_expires_at = $2 WHERE id = $3',
    [refreshToken, expiresAt.toISOString(), user.id]
  );

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 900,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw Object.assign(new Error('Refresh token obrigatório'), { status: 400 });
  const result = await query(
    'SELECT * FROM users WHERE refresh_token = $1 AND refresh_token_expires_at > now() AND active = true',
    [refreshToken]
  );
  const user = result.rows[0];
  if (!user) throw Object.assign(new Error('Refresh token inválido ou expirado'), { status: 401, code: 'REFRESH_INVALID' });

  const accessToken = generateAccessToken(user);
  return { access_token: accessToken, expires_in: 900 };
}

async function logout(userId) {
  await query('UPDATE users SET refresh_token = NULL, refresh_token_expires_at = NULL WHERE id = $1', [userId]);
}

module.exports = { login, refresh, logout };
