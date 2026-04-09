import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Mail, Users, Megaphone, LogOut, Menu, X
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/accounts', icon: Mail, label: 'Contas de E-mail' },
    { to: '/campaigns', icon: Megaphone, label: 'Campanhas' },
    { to: '/leads', icon: Users, label: 'Leads' },
  ];

  return (
    <div className="app-layout">
      {/* Mobile menu toggle */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 200 }}>
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>🔄 RevolveMail</h1>
          <span>Cold Email Automation</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <p>{user?.email}</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm w-full mt-sm" onClick={handleLogout}
            style={{ gap: '8px' }}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 99
        }} onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
