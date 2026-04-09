const cron = require('node-cron');
const { dbRun } = require('../database');

function startCronJobs() {
  cron.schedule('0 0 * * *', () => {
    try {
      const result = dbRun('UPDATE email_accounts SET sent_today = 0');
      console.log(`🔄 Reset diário executado: ${result.changes} contas resetadas`);
    } catch (err) {
      console.error('❌ Erro no reset diário:', err);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log('⏰ Cron jobs configurados (reset diário à meia-noite UTC)');
}

module.exports = { startCronJobs };
