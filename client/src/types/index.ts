export interface User {
  id: string;
  email: string;
}

export interface EmailAccount {
  id: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  secure: number;
  daily_limit: number;
  sent_today: number;
  last_sent_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  // Dashboard extras
  statusLabel?: string;
  statusColor?: string;
  progress?: number;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  emails_per_round: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
  total_leads?: number;
  sent_leads?: number;
  failed_leads?: number;
  pending_leads?: number;
}

export interface Lead {
  id: string;
  user_id: string;
  campaign_id: string;
  email: string;
  name: string | null;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  campaign_id: string;
  lead_id: string;
  account_id: string;
  status: 'sent' | 'failed';
  error_message: string | null;
  sent_at: string;
  lead_email?: string;
  lead_name?: string;
  account_email?: string;
  campaign_name?: string;
}

export interface LeadFolder {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  total_leads: number;
  pending_leads: number;
  sent_leads: number;
  failed_leads: number;
}

export interface DashboardStats {
  total_campaigns: number;
  total_accounts: number;
  total_leads: number;
  emails_sent_today: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
