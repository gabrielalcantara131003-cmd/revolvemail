const express = require('express');
const { dbAll, dbGet, dbRun } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/leads — Pastas (campanhas com contagem de leads)
router.get('/', (req, res) => {
  try {
    const folders = dbAll(`
      SELECT
        c.id as campaign_id,
        c.name as campaign_name,
        c.status as campaign_status,
        COUNT(l.id) as total_leads,
        SUM(CASE WHEN l.status = 'pending' THEN 1 ELSE 0 END) as pending_leads,
        SUM(CASE WHEN l.status = 'sent' THEN 1 ELSE 0 END) as sent_leads,
        SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) as failed_leads
      FROM campaigns c
      LEFT JOIN leads l ON l.campaign_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    res.json({ folders });
  } catch (err) {
    console.error('Erro ao listar pastas de leads:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/leads/:campaignId — Leads de uma campanha
router.get('/:campaignId', (req, res) => {
  try {
    const campaign = dbGet('SELECT id, name FROM campaigns WHERE id = ? AND user_id = ?', [req.params.campaignId, req.user.id]);

    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status;

    let query = 'SELECT * FROM leads WHERE campaign_id = ? AND user_id = ?';
    const params = [req.params.campaignId, req.user.id];

    if (statusFilter && ['pending', 'sent', 'failed'].includes(statusFilter)) {
      query += ' AND status = ?';
      params.push(statusFilter);
    }

    const countResult = dbGet(query.replace('SELECT *', 'SELECT COUNT(*) as count'), params);
    const total = countResult ? countResult.count : 0;

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const leads = dbAll(query, params);

    res.json({
      campaign,
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Erro ao listar leads:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/leads/campaign/:campaignId — Remover todos os leads de uma campanha
router.delete('/campaign/:campaignId', (req, res) => {
  try {
    const campaign = dbGet('SELECT id, status FROM campaigns WHERE id = ? AND user_id = ?', [req.params.campaignId, req.user.id]);

    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (campaign.status === 'active') return res.status(400).json({ error: 'Não é possível remover leads de uma campanha ativa' });

    // Delete logs referencing these leads first
    dbRun('DELETE FROM email_logs WHERE campaign_id = ?', [req.params.campaignId]);
    const result = dbRun('DELETE FROM leads WHERE campaign_id = ? AND user_id = ?', [req.params.campaignId, req.user.id]);

    res.json({ message: `${result.changes} leads removidos com sucesso`, removedCount: result.changes });
  } catch (err) {
    console.error('Erro ao remover leads:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/leads/single/:leadId — Remover lead individual
router.delete('/single/:leadId', (req, res) => {
  try {
    const lead = dbGet(`
      SELECT l.*, c.status as campaign_status FROM leads l
      JOIN campaigns c ON c.id = l.campaign_id
      WHERE l.id = ? AND l.user_id = ?
    `, [req.params.leadId, req.user.id]);

    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    if (lead.campaign_status === 'active') return res.status(400).json({ error: 'Não é possível remover lead de uma campanha ativa' });

    // Delete logs for this lead first
    dbRun('DELETE FROM email_logs WHERE lead_id = ?', [req.params.leadId]);
    dbRun('DELETE FROM leads WHERE id = ? AND user_id = ?', [req.params.leadId, req.user.id]);

    res.json({ message: 'Lead removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover lead:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
