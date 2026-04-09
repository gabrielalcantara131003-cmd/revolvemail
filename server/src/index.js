require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { initDb } = require('./database');
const { startWorker } = require('./services/emailWorker');
const { startCronJobs } = require('./services/cronJobs');

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const campaignRoutes = require('./routes/campaigns');
const leadRoutes = require('./routes/leads');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // Allow any origin for easy hosting
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  if (err.message === 'Apenas arquivos CSV são aceitos') return res.status(400).json({ error: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande. Máximo: 10MB' });
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicializar tudo de forma async
async function start() {
  await initDb();

  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║          🔄 REVOLVEMAIL SERVER           ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  Servidor rodando na porta ${PORT}          ║`);
    console.log(`║  http://localhost:${PORT}                   ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    startWorker();
    startCronJobs();
  });
}

start().catch(err => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
