import { useState, useEffect } from 'react';
import api from '../api/client';
import type { Lead, LeadFolder, Pagination } from '../types';
import {
  FolderOpen, Users, Trash2, ArrowLeft, ChevronLeft, ChevronRight,
  UserMinus
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Leads() {
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const fetchFolders = async () => {
    try {
      const res = await api.get('/leads');
      setFolders(res.data.folders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async (campaignId: string, page = 1) => {
    setLoadingLeads(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/leads/${campaignId}?${params}`);
      setLeads(res.data.leads);
      setPagination(res.data.pagination);
      setSelectedFolderName(res.data.campaign.name);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => { fetchFolders(); }, []);

  useEffect(() => {
    if (selectedFolder) {
      fetchLeads(selectedFolder);
    }
  }, [selectedFolder, statusFilter]);

  const openFolder = (campaignId: string, name: string) => {
    setSelectedFolder(campaignId);
    setSelectedFolderName(name);
    setStatusFilter('');
  };

  const closeFolder = () => {
    setSelectedFolder(null);
    setLeads([]);
    setPagination(null);
    fetchFolders();
  };

  const handleDeleteAllLeads = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja remover TODOS os leads desta campanha?')) return;
    try {
      const res = await api.delete(`/leads/campaign/${campaignId}`);
      toast.success(res.data.message);
      if (selectedFolder === campaignId) closeFolder();
      else fetchFolders();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover leads');
    }
  };

  const handleDeleteSingleLead = async (leadId: string) => {
    try {
      await api.delete(`/leads/single/${leadId}`);
      toast.success('Lead removido');
      if (selectedFolder) fetchLeads(selectedFolder, pagination?.page || 1);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover lead');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="badge badge-pending">Pendente</span>;
      case 'sent': return <span className="badge badge-sent">Enviado</span>;
      case 'failed': return <span className="badge badge-failed">Falhou</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><div><div className="skeleton skeleton-title"></div></div></div>
        <div className="folder-grid">
          {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: '150px' }}></div>)}
        </div>
      </div>
    );
  }

  // Vista de Leads dentro de uma pasta
  if (selectedFolder) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <button className="btn btn-secondary btn-sm mb-md" onClick={closeFolder}>
              <ArrowLeft size={16} /> Voltar para Pastas
            </button>
            <h2>{selectedFolderName}</h2>
            <p>Leads desta campanha</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select className="form-input" style={{ width: 'auto' }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="sent">Enviados</option>
              <option value="failed">Falhas</option>
            </select>
            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAllLeads(selectedFolder)}>
              <Trash2 size={14} /> Excluir Todos
            </button>
          </div>
        </div>

        {loadingLeads ? (
          <div className="card">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton skeleton-text" style={{ marginBottom: '16px' }}></div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <Users size={48} />
              <h3>Nenhum lead encontrado</h3>
              <p>Esta campanha não tem leads ou nenhum lead corresponde ao filtro selecionado</p>
            </div>
          </div>
        ) : (
          <>
            <div className="card" style={{ overflow: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id}>
                      <td>{lead.email}</td>
                      <td>{lead.name || '—'}</td>
                      <td>{getStatusBadge(lead.status)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {new Date(lead.created_at + 'Z').toLocaleDateString('pt-BR')}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDeleteSingleLead(lead.id)}
                          title="Remover lead">
                          <UserMinus size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                <button className="btn btn-secondary btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLeads(selectedFolder, pagination.page - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-muted">
                  Página {pagination.page} de {pagination.totalPages} ({pagination.total} leads)
                </span>
                <button className="btn btn-secondary btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchLeads(selectedFolder, pagination.page + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Vista de Pastas
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Leads</h2>
          <p>Leads organizados por campanha</p>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FolderOpen size={48} />
            <h3>Nenhuma campanha com leads</h3>
            <p>Crie uma campanha e importe um CSV para ver seus leads aqui organizados por pasta</p>
          </div>
        </div>
      ) : (
        <div className="folder-grid">
          {folders.map(folder => (
            <div key={folder.campaign_id} className="folder-card"
              onClick={() => openFolder(folder.campaign_id, folder.campaign_name)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="folder-icon">
                  <FolderOpen size={24} />
                </div>
                <button className="btn btn-danger btn-sm btn-icon"
                  onClick={e => { e.stopPropagation(); handleDeleteAllLeads(folder.campaign_id); }}
                  title="Excluir todos os leads">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="folder-name">{folder.campaign_name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {folder.total_leads} leads no total
              </div>

              <div className="folder-stats">
                <span className="folder-stat" style={{ color: 'var(--warning)' }}>
                  ⏳ {folder.pending_leads || 0}
                </span>
                <span className="folder-stat" style={{ color: 'var(--success)' }}>
                  ✓ {folder.sent_leads || 0}
                </span>
                <span className="folder-stat" style={{ color: 'var(--error)' }}>
                  ✕ {folder.failed_leads || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
