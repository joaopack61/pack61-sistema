'use strict';
const { rateLimit } = require('express-rate-limit');

exports.loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Muitas tentativas de login. Aguarde 1 minuto.', code: 'RATE_LIMITED' },
});

exports.writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Muitas requisições. Aguarde um momento.', code: 'RATE_LIMITED' },
});
