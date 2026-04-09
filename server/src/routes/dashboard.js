const express = require('express');
const { dbAll, dbGet } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  try {
    const activeCampaign = dbGet(`
      SELECT c.*,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id) as total_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'sent') as sent_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'failed') as failed_leads,
        (SELECT COUNT(*) FROM leads WHERE campaign_id = c.id AND status = 'pending') as pending_leads
      FROM campaigns c
      WHERE c.user_id = ? AND c.status = 'active'
      LIMIT 1
    `, [req.user.id]);

    const accounts = dbAll(`
      SELECT id, email, daily_limit, sent_today, last_sent_at, is_active
      FROM email_accounts WHERE user_id = ? ORDER BY email ASC
    `, [req.user.id]);

    const accountsWithStatus = accounts.map(acc => {
      let statusLabel = 'Inativa';
      let statusColor = 'gray';

      if (!acc.is_active) {
        statusLabel = 'Desativada';
        statusColor = 'gray';
      } else if (acc.sent_today >= acc.daily_limit) {
        statusLabel = 'Limite Atingido';
        statusColor = 'red';
      } else if (activeCampaign) {
        if (acc.last_sent_at) {
          const lastSent = new Date(acc.last_sent_at + 'Z').getTime();
          const now = Date.now();
          if (now - lastSent < 20000) {
            statusLabel = 'Enviando';
            statusColor = 'green';
          } else {
            statusLabel = 'Aguardando Rodada';
            statusColor = 'yellow';
          }
        } else {
          statusLabel = 'Aguardando Rodada';
          statusColor = 'yellow';
        }
      } else {
        statusLabel = 'Ociosa';
        statusColor = 'blue';
      }

      return {
        ...acc,
        statusLabel,
        statusColor,
        progress: acc.daily_limit > 0 ? Math.round((acc.sent_today / acc.daily_limit) * 100) : 0,
      };
    });

    const totalStats = dbGet(`
      SELECT
        (SELECT COUNT(*) FROM campaigns WHERE user_id = ?) as total_campaigns,
        (SELECT COUNT(*) FROM email_accounts WHERE user_id = ?) as total_accounts,
        (SELECT COUNT(*) FROM leads WHERE user_id = ?) as total_leads,
        (SELECT COALESCE(SUM(sent_today), 0) FROM email_accounts WHERE user_id = ?) as emails_sent_today
    `, [req.user.id, req.user.id, req.user.id, req.user.id]);

    res.json({ activeCampaign, accounts: accountsWithStatus, stats: totalStats });
  } catch (err) {
    console.error('Erro ao buscar stats:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/dashboard/logs
router.get('/logs', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;
    const campaignId = req.query.campaign_id;

    let query = `
      SELECT el.*, l.email as lead_email, l.name as lead_name,
             ea.email as account_email, c.name as campaign_name
      FROM email_logs el
      JOIN leads l ON l.id = el.lead_id
      JOIN email_accounts ea ON ea.id = el.account_id
      JOIN campaigns c ON c.id = el.campaign_id
      WHERE c.user_id = ?
    `;
    const params = [req.user.id];

    if (campaignId) {
      query += ' AND el.campaign_id = ?';
      params.push(campaignId);
    }

    const countQuery = query.replace(/SELECT el\.\*.*FROM/, 'SELECT COUNT(*) as count FROM');
    const totalResult = dbGet(countQuery, params);
    const total = totalResult ? totalResult.count : 0;

    query += ' ORDER BY el.sent_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = dbAll(query, params);

    res.json({ logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('Erro ao buscar logs:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
