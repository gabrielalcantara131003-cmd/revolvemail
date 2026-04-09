import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { LogIn, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>🔄 RevolveMail</h1>
          <p>Faça login para acessar sua conta</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" type="email" className="form-input"
              placeholder="seu@email.com" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Senha</label>
            <input id="login-password" type="password" className="form-input"
              placeholder="Sua senha" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? <Loader size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="auth-link">
          Não tem uma conta? <Link to="/register">Criar conta</Link>
        </div>
      </div>
    </div>
  );
}
