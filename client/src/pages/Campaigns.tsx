import { useState, useEffect } from 'react';
import api from '../api/client';
import type { Campaign } from '../types';
import {
  Megaphone, Plus, Play, Pause, Trash2, Loader, X, Upload, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formEmailsPerRound, setFormEmailsPerRound] = useState('1');
  const [formCsvFile, setFormCsvFile] = useState<File | null>(null);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data.campaigns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCsvFile) {
      toast.error('Selecione um arquivo CSV com os leads');
      return;
    }
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('name', formName);
      formData.append('subject', formSubject);
      formData.append('body', formBody);
      formData.append('emails_per_round', formEmailsPerRound);
      formData.append('csv', formCsvFile);

      const res = await api.post('/campaigns', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const stats = res.data.csvStats;
      toast.success(`Campanha criada! ${stats.inserted} leads importados.`);

      if (stats.errors.length > 0) {
        toast(`⚠️ ${stats.errors.length} linha(s) com erro no CSV`, { icon: '⚠️' });
      }

      setShowCreateModal(false);
      resetForm();
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar campanha');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await api.patch(`/campaigns/${id}/${action}`);
      toast.success(res.data.message);
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro na ação');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta campanha? Todos os leads e logs serão perdidos.')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success('Campanha removida');
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setFormEmailsPerRound('1');
    setFormCsvFile(null);
  };

  const insertVariable = (variable: string) => {
    setFormBody(prev => prev + variable);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <span className="badge badge-draft">Rascunho</span>;
      case 'active': return <span className="badge badge-active">● Ativa</span>;
      case 'paused': return <span className="badge badge-paused">⏸ Pausada</span>;
      case 'completed': return <span className="badge badge-completed">✓ Concluída</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><div><div className="skeleton skeleton-title"></div></div></div>
        <div className="card-grid">
          {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: '200px' }}></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Campanhas</h2>
          <p>Crie e gerencie suas campanhas de cold email</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} /> Nova Campanha
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Megaphone size={48} />
            <h3>Nenhuma campanha criada</h3>
            <p>Crie uma nova campanha com upload de CSV para começar seus envios</p>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {campaigns.map(c => (
            <div key={c.id} className="card">
              <div className="card-header">
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                {getStatusBadge(c.status)}
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                <p><strong>Assunto:</strong> {c.subject}</p>
              </div>

              {/* Progress */}
              <div className="progress-info">
                <span>{c.sent_leads || 0} / {c.total_leads || 0} enviados</span>
                <span>{c.total_leads ? Math.round(((c.sent_leads || 0) / c.total_leads) * 100) : 0}%</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill"
                  style={{ width: `${c.total_leads ? Math.round(((c.sent_leads || 0) / c.total_leads) * 100) : 0}%` }}></div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--warning)' }}>⏳ {c.pending_leads || 0}</span>
                <span style={{ color: 'var(--success)' }}>✓ {c.sent_leads || 0}</span>
                <span style={{ color: 'var(--error)' }}>✕ {c.failed_leads || 0}</span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                {(c.status === 'draft' || c.status === 'paused') && (
                  <button className="btn btn-success btn-sm"
                    onClick={() => handleAction(c.id, c.status === 'paused' ? 'resume' : 'start')}>
                    <Play size={14} /> {c.status === 'paused' ? 'Retomar' : 'Iniciar'}
                  </button>
                )}
                {c.status === 'active' && (
                  <button className="btn btn-warning btn-sm" onClick={() => handleAction(c.id, 'pause')}>
                    <Pause size={14} /> Pausar
                  </button>
                )}
                {c.status !== 'active' && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
                    <Trash2 size={14} /> Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Criar Campanha */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Nova Campanha</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Nome da Campanha</label>
                <input className="form-input" placeholder="Ex: Prospecção Q1 2025"
                  value={formName} onChange={e => setFormName(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Assunto do E-mail</label>
                <input className="form-input" placeholder="Ex: Olá {{name}}, tenho uma proposta"
                  value={formSubject} onChange={e => setFormSubject(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Corpo do E-mail</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className="text-sm text-muted">Variáveis:</span>
                  <span className="var-tag" onClick={() => insertVariable('{{name}}')}>{'{{name}}'}</span>
                  <span className="var-tag" onClick={() => insertVariable('{{email}}')}>{'{{email}}'}</span>
                  <span className="var-tag" onClick={() => insertVariable('{{first_name}}')}>{'{{first_name}}'}</span>
                </div>
                <textarea className="form-input" rows={6}
                  placeholder={"Olá {{name}},\n\nGostaria de apresentar nosso serviço...\n\nAtenciosamente,\nSeu Nome"}
                  value={formBody} onChange={e => setFormBody(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Arquivo CSV de Leads</label>
                <div className={`file-upload ${formCsvFile ? 'has-file' : ''}`}>
                  <input type="file" accept=".csv"
                    onChange={e => setFormCsvFile(e.target.files?.[0] || null)} />
                  <div className="file-upload-icon">
                    {formCsvFile ? <FileText size={32} /> : <Upload size={32} />}
                  </div>
                  {formCsvFile ? (
                    <p className="file-name">{formCsvFile.name}</p>
                  ) : (
                    <p>Clique ou arraste um arquivo CSV<br />
                      <span className="text-sm text-muted">Colunas necessárias: email, name</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><Loader size={16} className="animate-spin" /> Criando...</> : 'Criar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
