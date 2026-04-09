import { useState, useEffect } from 'react';
import api from '../api/client';
import type { Campaign, EmailAccount, EmailLog, DashboardStats } from '../types';
import {
  LayoutDashboard, Mail, Users, Megaphone, TrendingUp,
  CheckCircle, XCircle
} from 'lucide-react';

export default function Dashboard() {
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/logs?limit=20'),
      ]);

      setActiveCampaign(statsRes.data.activeCampaign);
      setAccounts(statsRes.data.accounts);
      setStats(statsRes.data.stats);
      setLogs(logsRes.data.logs);
    } catch (err) {
      console.error('Erro ao buscar dados do dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><div><div className="skeleton skeleton-title"></div></div></div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card"></div>)}
        </div>
        <div className="card"><div className="skeleton skeleton-card"></div></div>
      </div>
    );
  }

  const campaignProgress = activeCampaign
    ? Math.round(((activeCampaign.sent_leads || 0) / (activeCampaign.total_leads || 1)) * 100)
    : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Visão geral e monitoramento em tempo real</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple"><Megaphone size={24} /></div>
          <div>
            <div className="stat-value">{stats?.total_campaigns || 0}</div>
            <div className="stat-label">Campanhas</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><Mail size={24} /></div>
          <div>
            <div className="stat-value">{stats?.total_accounts || 0}</div>
            <div className="stat-label">Contas de E-mail</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Users size={24} /></div>
          <div>
            <div className="stat-value">{stats?.total_leads || 0}</div>
            <div className="stat-label">Leads Totais</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><TrendingUp size={24} /></div>
          <div>
            <div className="stat-value">{stats?.emails_sent_today || 0}</div>
            <div className="stat-label">Enviados Hoje</div>
          </div>
        </div>
      </div>

      {/* Active Campaign Progress */}
      {activeCampaign ? (
        <div className="card mb-lg">
          <div className="card-header">
            <h3 className="card-title">Campanha Ativa: {activeCampaign.name}</h3>
            <span className="badge badge-active">● Ativa</span>
          </div>
          <div className="progress-info">
            <span style={{ fontWeight: 600 }}>
              {activeCampaign.sent_leads || 0} / {activeCampaign.total_leads || 0} e-mails enviados
            </span>
            <span>{campaignProgress}%</span>
          </div>
          <div className="progress-bar-container progress-bar-big">
            <div className="progress-bar-fill" style={{ width: `${campaignProgress}%` }}></div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--success)' }}>✓ Enviados: {activeCampaign.sent_leads || 0}</span>
            <span style={{ color: 'var(--warning)' }}>⏳ Pendentes: {activeCampaign.pending_leads || 0}</span>
            <span style={{ color: 'var(--error)' }}>✕ Falhas: {activeCampaign.failed_leads || 0}</span>
          </div>
        </div>
      ) : (
        <div className="card mb-lg">
          <div className="empty-state" style={{ padding: '2rem' }}>
            <LayoutDashboard size={40} />
            <h3>Nenhuma campanha ativa</h3>
            <p>Inicie uma campanha para ver o progresso em tempo real aqui</p>
          </div>
        </div>
      )}

      {/* Account Status Grid */}
      {accounts.length > 0 && (
        <div className="mb-lg">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
            Monitoramento por Conta
          </h3>
          <div className="card-grid">
            {accounts.map(acc => (
              <div key={acc.id} className="account-card">
                <div className="account-card-header">
                  <span className="account-email">{acc.email}</span>
                  <div className="account-status" style={{ color: `var(--${acc.statusColor === 'yellow' ? 'warning' : acc.statusColor === 'green' ? 'success' : acc.statusColor === 'red' ? 'error' : acc.statusColor === 'blue' ? 'info' : 'text-muted'})` }}>
                    <span className={`status-dot ${acc.statusColor}`}></span>
                    {acc.statusLabel}
                  </div>
                </div>

                <div className="progress-info">
                  <span>{acc.sent_today} / {acc.daily_limit}</span>
                  <span>{acc.progress}%</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${acc.progress}%` }}></div>
                </div>

                <div className="account-meta">
                  <span>Último envio: {acc.last_sent_at ? formatTime(acc.last_sent_at) : 'Nunca'}</span>
                  <span>{acc.is_active ? 'Ativa' : 'Desativada'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs Feed */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Logs de Envio Recentes</h3>
          <span className="text-sm text-muted">Atualização a cada 3s</span>
        </div>

        {logs.length > 0 ? (
          <div className="feed-list">
            {logs.map(log => (
              <div key={log.id} className="feed-item">
                {log.status === 'sent'
                  ? <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  : <XCircle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
                }
                <span className="time">{formatTime(log.sent_at)}</span>
                <span className="account">{log.account_email}</span>
                <span className="arrow">→</span>
                <span className="target">{log.lead_email}</span>
                {log.error_message && (
                  <span style={{ color: 'var(--error)', fontSize: '0.75rem' }} title={log.error_message}>
                    ⚠
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Nenhum log de envio ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}
