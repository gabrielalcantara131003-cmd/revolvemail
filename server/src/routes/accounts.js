const express = require('express');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const { dbAll, dbGet, dbRun } = require('../database');
const { encrypt, decrypt } = require('../services/encryption');
const { validateEmail, validateRequired } = require('../utils/validators');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/accounts
router.get('/', (req, res) => {
  try {
    const accounts = dbAll(`
      SELECT id, email, smtp_host, smtp_port, secure, daily_limit, sent_today,
             last_sent_at, is_active, created_at, updated_at
      FROM email_accounts WHERE user_id = ? ORDER BY created_at DESC
    `, [req.user.id]);

    res.json({ accounts });
  } catch (err) {
    console.error('Erro ao listar contas:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/accounts
router.post('/', async (req, res) => {
  try {
    const { email, app_password, smtp_host, smtp_port, secure, daily_limit } = req.body;

    const missing = validateRequired(['email', 'app_password'], req.body);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatórios: ${missing.join(', ')}` });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Formato de e-mail inválido' });
    }

    const host = smtp_host || 'smtp.gmail.com';
    const port = parseInt(smtp_port) || 587;
    // O Nodemailer exige secure: true apenas para 465. Para 587, deve ser false.
    const isSecure = port === 465;
    
    // Google app passwords podem vir com espaços. Removemos todos.
    const cleanPassword = app_password.trim().replace(/\s+/g, '');

    // Validar conexão SMTP
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: isSecure,
        requireTLS: port === 587, // força starttls para a porta 587
        auth: { user: email, pass: cleanPassword },
        tls: {
          rejectUnauthorized: false // Aceitar conexões cloud sem quebrar por restrições rigorosas de CA
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
      });

      await transporter.verify();
      transporter.close();
    } catch (smtpErr) {
      console.error('SMTP Error:', smtpErr); // Para registrar no console da Vercel/Render
      return res.status(400).json({
        error: 'Falha na validação SMTP. Verifique as credenciais e configurações.',
        details: smtpErr.message,
      });
    }

    const accountId = uuidv4();
    const encryptedPassword = encrypt(cleanPassword);

    dbRun(`
      INSERT INTO email_accounts (id, user_id, email, app_password, smtp_host, smtp_port, secure, daily_limit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [accountId, req.user.id, email.toLowerCase(), encryptedPassword, host, port, isSecure ? 1 : 0, daily_limit || 500]);

    const account = dbGet(`
      SELECT id, email, smtp_host, smtp_port, secure, daily_limit, sent_today,
             last_sent_at, is_active, created_at
      FROM email_accounts WHERE id = ?
    `, [accountId]);

    res.status(201).json({ message: 'Conta adicionada e validada com sucesso', account });
  } catch (err) {
    console.error('Erro ao adicionar conta:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/accounts/:id
router.put('/:id', (req, res) => {
  try {
    const account = dbGet('SELECT * FROM email_accounts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    const { daily_limit, smtp_host, smtp_port, secure } = req.body;

    const updates = [];
    const values = [];

    if (daily_limit !== undefined) {
      const limit = parseInt(daily_limit);
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({ error: 'Limite diário deve ser um número positivo' });
      }
      updates.push('daily_limit = ?');
      values.push(limit);
    }

    if (smtp_host) { updates.push('smtp_host = ?'); values.push(smtp_host); }
    if (smtp_port) { updates.push('smtp_port = ?'); values.push(parseInt(smtp_port)); }
    if (secure !== undefined) { updates.push('secure = ?'); values.push(secure ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id, req.user.id);

    dbRun(`UPDATE email_accounts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);

    const updated = dbGet(`
      SELECT id, email, smtp_host, smtp_port, secure, daily_limit, sent_today,
             last_sent_at, is_active, created_at, updated_at
      FROM email_accounts WHERE id = ?
    `, [req.params.id]);

    res.json({ message: 'Conta atualizada com sucesso', account: updated });
  } catch (err) {
    console.error('Erro ao atualizar conta:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/accounts/:id/toggle
router.patch('/:id/toggle', (req, res) => {
  try {
    const account = dbGet('SELECT * FROM email_accounts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    const newStatus = account.is_active ? 0 : 1;
    dbRun("UPDATE email_accounts SET is_active = ?, updated_at = datetime('now') WHERE id = ?", [newStatus, req.params.id]);

    res.json({ message: newStatus ? 'Conta ativada' : 'Conta desativada', is_active: !!newStatus });
  } catch (err) {
    console.error('Erro ao alternar status:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
  try {
    const result = dbRun('DELETE FROM email_accounts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    res.json({ message: 'Conta removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover conta:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
