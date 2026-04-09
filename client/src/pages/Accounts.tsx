import { useState, useEffect } from 'react';
import api from '../api/client';
import type { EmailAccount } from '../types';
import { Mail, Plus, Trash2, Edit3, Loader, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Accounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<EmailAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formHost, setFormHost] = useState('smtp.gmail.com');
  const [formPort, setFormPort] = useState('587');
  const [formLimit, setFormLimit] = useState('500');

  // Edit form
  const [editLimit, setEditLimit] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounts');
      setAccounts(res.data.accounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post('/accounts', {
        email: formEmail,
        app_password: formPassword,
        smtp_host: formHost,
        smtp_port: parseInt(formPort),
        daily_limit: parseInt(formLimit),
      });
      toast.success('Conta adicionada e validada com sucesso!');
      setShowAddModal(false);
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar conta');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await api.patch(`/accounts/${id}/toggle`);
      toast.success(res.data.message);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao alternar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta conta?')) return;
    try {
      await api.delete(`/accounts/${id}`);
      toast.success('Conta removida');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover');
    }
  };

  const handleEditSave = async () => {
    if (!editAccount) return;
    setSaving(true);

    try {
      await api.put(`/accounts/${editAccount.id}`, {
        daily_limit: parseInt(editLimit),
      });
      toast.success('Limite diário atualizado!');
      setEditAccount(null);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormEmail('');
    setFormPassword('');
    setFormHost('smtp.gmail.com');
    setFormPort('587');
    setFormLimit('500');
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><div><div className="skeleton skeleton-title"></div></div></div>
        <div className="card-grid">
          {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: '180px' }}></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Contas de E-mail</h2>
          <p>Gerencie suas contas SMTP para envio de e-mails</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Adicionar Conta
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Mail size={48} />
            <h3>Nenhuma conta adicionada</h3>
            <p>Adicione suas contas de e-mail Gmail para começar a enviar campanhas</p>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {accounts.map(acc => (
            <div key={acc.id} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <Mail size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.email}
                  </span>
                </div>
                <label className="toggle" title={acc.is_active ? 'Desativar' : 'Ativar'}>
                  <input type="checkbox" checked={!!acc.is_active}
                    onChange={() => handleToggle(acc.id)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                <span>Host: {acc.smtp_host}</span>
                <span>Porta: {acc.smtp_port}</span>
                <span>Limite: {acc.daily_limit}/dia</span>
                <span>Enviados: {acc.sent_today}</span>
              </div>

              <div className="progress-info">
                <span>{acc.sent_today} / {acc.daily_limit}</span>
                <span>{acc.daily_limit > 0 ? Math.round((acc.sent_today / acc.daily_limit) * 100) : 0}%</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${acc.daily_limit > 0 ? Math.round((acc.sent_today / acc.daily_limit) * 100) : 0}%` }}></div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setEditAccount(acc);
                  setEditLimit(String(acc.daily_limit));
                }}>
                  <Edit3 size={14} /> Editar Limite
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(acc.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Adicionar Conta */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Adicionar Conta de E-mail</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>E-mail</label>
                <input className="form-input" type="email" placeholder="conta@gmail.com"
                  value={formEmail} onChange={e => setFormEmail(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Senha de App (Google App Password)</label>
                <input className="form-input" type="password" placeholder="xxxx xxxx xxxx xxxx"
                  value={formPassword} onChange={e => setFormPassword(e.target.value)} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Host SMTP</label>
                  <input className="form-input" value={formHost}
                    onChange={e => setFormHost(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Porta SMTP</label>
                  <input className="form-input" type="number" value={formPort}
                    onChange={e => setFormPort(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label>Limite Diário de Envios</label>
                <input className="form-input" type="number" value={formLimit}
                  onChange={e => setFormLimit(e.target.value)} min="1" required />
                <span className="text-sm text-muted mt-sm" style={{ display: 'block' }}>
                  Gmail gratuito: 500 | Google Workspace: 2000
                </span>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><Loader size={16} className="animate-spin" /> Validando SMTP...</> : 'Adicionar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Limite */}
      {editAccount && (
        <div className="modal-overlay" onClick={() => setEditAccount(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Editar Limite Diário</h3>
              <button className="modal-close" onClick={() => setEditAccount(null)}><X size={20} /></button>
            </div>

            <p className="text-sm text-muted mb-md">Conta: <strong style={{ color: 'var(--accent)' }}>{editAccount.email}</strong></p>

            <div className="form-group">
              <label>Limite Diário de Envios</label>
              <input className="form-input" type="number" value={editLimit}
                onChange={e => setEditLimit(e.target.value)} min="1" />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditAccount(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>
                {saving ? <Loader size={16} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
