'use strict';
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const authService = require('../services/authService');

const router = express.Router();

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: true, message: 'E-mail e senha obrigatórios', code: 'MISSING_FIELDS' });
    const result = await authService.login(email, password);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: true, message: e.message, code: e.code || 'LOGIN_ERROR' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const result = await authService.refresh(refresh_token);
    res.json(result);
  } catch (e) {
    res.status(e.status || 401).json({ error: true, message: e.message, code: e.code || 'REFRESH_ERROR' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    await authService.logout(req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
