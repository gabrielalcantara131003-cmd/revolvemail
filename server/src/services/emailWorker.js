const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { dbAll, dbGet, dbRun } = require('../database');
const { decrypt } = require('./encryption');

const workerState = {
  isRunning: false,
  currentCampaignId: null,
  currentAccountIndex: 0,
  lastAction: null,
};

function replaceVariables(template, lead) {
  let result = template;
  result = result.replace(/\{\{name\}\}/gi, lead.name || '');
  result = result.replace(/\{\{email\}\}/gi, lead.email || '');
  result = result.replace(/\{\{first_name\}\}/gi, (lead.name || '').split(' ')[0] || '');
  return result;
}

async function sendSingleEmail(account, campaign, lead) {
  try {
    const decryptedPassword = decrypt(account.app_password);

    const port = account.smtp_port;
    const isSecure = port === 465;

    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: port,
      secure: isSecure,
      requireTLS: port === 587,
      auth: { user: account.email, pass: decryptedPassword },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });

    const subject = replaceVariables(campaign.subject, lead);
    const body = replaceVariables(campaign.body, lead);
    const isHtml = /<[a-z][\s\S]*>/i.test(body);

    await transporter.sendMail({
      from: account.email,
      to: lead.email,
      subject,
      ...(isHtml ? { html: body } : { text: body }),
    });

    transporter.close();

    dbRun(`INSERT INTO email_logs (id, campaign_id, lead_id, account_id, status, sent_at) VALUES (?, ?, ?, ?, 'sent', datetime('now'))`,
      [uuidv4(), campaign.id, lead.id, account.id]);
    dbRun("UPDATE leads SET status = 'sent', updated_at = datetime('now') WHERE id = ?", [lead.id]);
    dbRun("UPDATE email_accounts SET sent_today = sent_today + 1, last_sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [account.id]);

    console.log(`✅ E-mail enviado: ${account.email} → ${lead.email} (Campanha: ${campaign.name})`);
    return true;
  } catch (err) {
    console.error(`❌ Falha no envio: ${account.email} → ${lead.email}: ${err.message}`);

    dbRun(`INSERT INTO email_logs (id, campaign_id, lead_id, account_id, status, error_message, sent_at) VALUES (?, ?, ?, ?, 'failed', ?, datetime('now'))`,
      [uuidv4(), campaign.id, lead.id, account.id, err.message]);
    dbRun("UPDATE leads SET status = 'failed', updated_at = datetime('now') WHERE id = ?", [lead.id]);

    return false;
  }
}

async function processNextEmail() {
  if (workerState.isRunning) return;
  workerState.isRunning = true;

  try {
    const activeCampaigns = dbAll("SELECT * FROM campaigns WHERE status = 'active'");

    if (activeCampaigns.length === 0) {
      workerState.isRunning = false;
      return;
    }

    for (const campaign of activeCampaigns) {
      const availableAccounts = dbAll(`
        SELECT * FROM email_accounts
        WHERE user_id = ? AND is_active = 1 AND sent_today < daily_limit
        ORDER BY email ASC
      `, [campaign.user_id]);

      if (availableAccounts.length === 0) {
        console.log(`⏸️ Campanha "${campaign.name}": Nenhuma conta disponível`);
        dbRun("UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ?", [campaign.id]);
        continue;
      }

      const nextLead = dbGet(`
        SELECT * FROM leads WHERE campaign_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1
      `, [campaign.id]);

      if (!nextLead) {
        console.log(`✅ Campanha "${campaign.name}" concluída`);
        dbRun("UPDATE campaigns SET status = 'completed', updated_at = datetime('now') WHERE id = ?", [campaign.id]);
        continue;
      }

      if (workerState.currentCampaignId !== campaign.id) {
        workerState.currentCampaignId = campaign.id;
        workerState.currentAccountIndex = 0;
      }

      if (workerState.currentAccountIndex >= availableAccounts.length) {
        workerState.currentAccountIndex = 0;
      }

      const selectedAccount = availableAccounts[workerState.currentAccountIndex];

      await sendSingleEmail(selectedAccount, campaign, nextLead);

      workerState.currentAccountIndex = (workerState.currentAccountIndex + 1) % availableAccounts.length;
      workerState.lastAction = new Date().toISOString();

      const delayMs = Math.floor(Math.random() * 10000) + 5000;
      console.log(`⏳ Aguardando ${(delayMs / 1000).toFixed(1)}s antes do próximo envio...`);

      workerState.isRunning = false;
      setTimeout(() => processNextEmail(), delayMs);
      return;
    }
  } catch (err) {
    console.error('Erro no worker de e-mail:', err);
  }

  workerState.isRunning = false;
}

let workerInterval = null;

function startWorker() {
  console.log('🚀 Email Worker iniciado');

  workerInterval = setInterval(() => {
    if (!workerState.isRunning) {
      try {
        const hasActive = dbGet("SELECT COUNT(*) as count FROM campaigns WHERE status = 'active'");
        if (hasActive && hasActive.count > 0) {
          processNextEmail();
        }
      } catch(e) { /* db not ready yet */ }
    }
  }, 10000);
}

function stopWorker() {
  if (workerInterval) { clearInterval(workerInterval); workerInterval = null; }
  console.log('⏹️ Email Worker parado');
}

function getWorkerState() { return { ...workerState }; }

module.exports = { startWorker, stopWorker, getWorkerState };
