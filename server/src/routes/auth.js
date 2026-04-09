const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { dbAll, dbGet, dbRun } = require('../database');
const { validateEmail, validateRequired } = require('../utils/validators');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    const missing = validateRequired(['email', 'password'], req.body);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatórios: ${missing.join(', ')}` });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Formato de e-mail inválido' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const existing = dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    dbRun('INSERT INTO users (id, email, password) VALUES (?, ?, ?)', [userId, email.toLowerCase(), hashedPassword]);

    const token = jwt.sign(
      { userId, email: email.toLowerCase() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Conta criada com sucesso',
      token,
      user: { id: userId, email: email.toLowerCase() },
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const missing = validateRequired(['email', 'password'], req.body);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatórios: ${missing.join(', ')}` });
    }

    const user = dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
