const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'revolvemail.db');
let db = null;

async function initDb() {
  if (db) return db;

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Carregar banco existente ou criar novo
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Habilitar foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Executar migrations
  runMigrations(db);

  // Salvar no disco
  saveDb();

  console.log('✅ Database inicializado com sucesso');
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database não inicializado. Chame initDb() primeiro.');
  }
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Auto-save a cada 5 segundos
setInterval(() => {
  if (db) saveDb();
}, 5000);

function runMigrations(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS email_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      app_password TEXT NOT NULL,
      smtp_host TEXT NOT NULL DEFAULT 'smtp.gmail.com',
      smtp_port INTEGER NOT NULL DEFAULT 587,
      secure INTEGER NOT NULL DEFAULT 0,
      daily_limit INTEGER NOT NULL DEFAULT 500,
      sent_today INTEGER NOT NULL DEFAULT 0,
      last_sent_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      emails_per_round INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY NOT NULL,
      campaign_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE
    )
  `);

  // Índices
  try { database.run('CREATE INDEX IF NOT EXISTS idx_leads_campaign_status ON leads(campaign_id, status)'); } catch(e) {}
  try { database.run('CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON email_logs(campaign_id)'); } catch(e) {}
  try { database.run('CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id)'); } catch(e) {}
  try { database.run('CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON campaigns(user_id, status)'); } catch(e) {}
}

// Helper: executar query e retornar todos os resultados como array de objetos
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: executar query e retornar o primeiro resultado como objeto
function dbGet(sql, params = []) {
  const results = dbAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper: executar INSERT/UPDATE/DELETE
function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return { changes: db.getRowsModified() };
}

module.exports = { initDb, getDb, saveDb, dbAll, dbGet, dbRun };
