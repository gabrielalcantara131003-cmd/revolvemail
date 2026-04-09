const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { dbAll, dbGet, dbRun } = require('../database');
const { parseCSV } = require('../utils/csvParser');
const { validateRequired } = require('../utils/validators');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são aceitos'));
    }
  },
});

// GET /api/campaigns
router.get('/', (req, res) => {
  try {
    const campaigns = dbAll(`
      SELECT c.*,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as total_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'sent') as sent_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'failed') as failed_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'pending') as pending_leads
      FROM campaigns c
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    res.json({ campaigns });
  } catch (err) {
    console.error('Erro ao listar campanhas:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/campaigns/:id
router.get('/:id', (req, res) => {
  try {
    const campaign = dbGet(`
      SELECT c.*,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as total_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'sent') as sent_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'failed') as failed_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'pending') as pending_leads
      FROM campaigns c
      WHERE c.id = ? AND c.user_id = ?
    `, [req.params.id, req.user.id]);

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json({ campaign });
  } catch (err) {
    console.error('Erro ao buscar campanha:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/campaigns — Criar campanha com CSV
router.post('/', upload.single('csv'), (req, res) => {
  try {
    const { name, subject, body, emails_per_round } = req.body;

    const missing = validateRequired(['name', 'subject', 'body'], req.body);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatórios: ${missing.join(', ')}` });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo CSV de leads é obrigatório' });
    }

    const csvResult = parseCSV(req.file.buffer);

    if (csvResult.leads.length === 0) {
      return res.status(400).json({
        error: 'Nenhum lead válido encontrado no CSV',
        csvErrors: csvResult.errors,
      });
    }

    const campaignId = uuidv4();

    dbRun(`
      INSERT INTO campaigns (id, user_id, name, subject, body, emails_per_round)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [campaignId, req.user.id, name, subject, body, parseInt(emails_per_round) || 1]);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const lead of csvResult.leads) {
      const exists = dbGet('SELECT id FROM leads WHERE campaign_id = ? AND email = ?', [campaignId, lead.email]);

      if (exists) {
        skippedCount++;
        continue;
      }

      dbRun('INSERT INTO leads (id, user_id, campaign_id, email, name) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), req.user.id, campaignId, lead.email, lead.name]);
      insertedCount++;
    }

    const campaign = dbGet(`
      SELECT c.*, (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as total_leads
      FROM campaigns c WHERE c.id = ?
    `, [campaignId]);

    res.status(201).json({
      message: 'Campanha criada com sucesso',
      campaign,
      csvStats: {
        totalParsed: csvResult.totalParsed,
        inserted: insertedCount,
        skipped: skippedCount,
        duplicatesInFile: csvResult.duplicatesRemoved,
        errors: csvResult.errors,
      },
    });
  } catch (err) {
    console.error('Erro ao criar campanha:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/campaigns/:id
router.put('/:id', (req, res) => {
  try {
    const campaign = dbGet('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status === 'active') return res.status(400).json({ error: 'Não é possível editar uma campanha ativa. Pause-a primeiro.' });

    const { name, subject, body, emails_per_round } = req.body;
    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (subject) { updates.push('subject = ?'); values.push(subject); }
    if (body) { updates.push('body = ?'); values.push(body); }
    if (emails_per_round) { updates.push('emails_per_round = ?'); values.push(parseInt(emails_per_round)); }

    if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id, req.user.id);

    dbRun(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);

    const updated = dbGet(`
      SELECT c.*, (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as total_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'sent') as sent_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'pending') as pending_leads
      FROM campaigns c WHERE c.id = ?
    `, [req.params.id]);

    res.json({ message: 'Campanha atualizada com sucesso', campaign: updated });
  } catch (err) {
    console.error('Erro ao atualizar campanha:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', (req, res) => {
  try {
    const campaign = dbGet('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status === 'active') return res.status(400).json({ error: 'Não é possível remover uma campanha ativa. Pause-a primeiro.' });

    // Delete logs first, then leads, then campaign (respecting foreign keys)
    dbRun('DELETE FROM email_logs WHERE campaign_id = ?', [req.params.id]);
    dbRun('DELETE FROM leads WHERE campaign_id = ?', [req.params.id]);
    dbRun('DELETE FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    res.json({ message: 'Campanha removida com sucesso' });
  } catch (err) {
    console.error('Erro ao remover campanha:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/campaigns/:id/start
router.patch('/:id/start', (req, res) => {
  try {
    const campaign = dbGet('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status === 'active') return res.status(400).json({ error: 'Campanha já está ativa' });
    if (campaign.status === 'completed') return res.status(400).json({ error: 'Campanha já foi concluída' });

    const pendingLeads = dbGet("SELECT COUNT(*) as count FROM leads WHERE campaign_id = ? AND status = 'pending'", [req.params.id]);
    if (pendingLeads.count === 0) return res.status(400).json({ error: 'Não há leads pendentes para envio' });

    const activeAccounts = dbGet('SELECT COUNT(*) as count FROM email_accounts WHERE user_id = ? AND is_active = 1', [req.user.id]);
    if (activeAccounts.count === 0) return res.status(400).json({ error: 'Nenhuma conta de e-mail ativa encontrada.' });

    dbRun("UPDATE campaigns SET status = 'active', updated_at = datetime('now') WHERE id = ?", [req.params.id]);

    res.json({ message: 'Campanha iniciada com sucesso', status: 'active' });
  } catch (err) {
    console.error('Erro ao iniciar campanha:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/campaigns/:id/pause
router.patch('/:id/pause', (req, res) => {
  try {
    const campaign = dbGet('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status !== 'active') return res.status(400).json({ error: 'Apenas campanhas ativas podem ser pausadas' });

    dbRun("UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ?", [req.params.id]);

    res.json({ message: 'Campanha pausada com sucesso', status: 'paused' });
  } catch (err) {
    console.error('Erro ao pausar campanha:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/campaigns/:id/resume
router.patch('/:id/resume', (req, res) => {
  try {
    const campaign = dbGet('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status !== 'paused') return res.status(400).json({ error: 'Apenas campanhas pausadas podem ser retomadas' });

    const pendingLeads = dbGet("SELECT COUNT(*) as count FROM leads WHERE campaign_id = ? AND status = 'pending'", [req.params.id]);
    if (pendingLeads.count === 0) {
      dbRun("UPDATE campaigns SET status = 'completed', updated_at = datetime('now') WHERE id = ?", [req.params.id]);
      return res.json({ message: 'Sem leads pendentes. Campanha marcada como concluída.', status: 'completed' });
    }

    dbRun("UPDATE campaigns SET status = 'active', updated_at = datetime('now') WHERE id = ?", [req.params.id]);
    res.json({ message: 'Campanha retomada com sucesso', status: 'active' });
  } catch (err) {
    console.error('Erro ao retomar campanha:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
