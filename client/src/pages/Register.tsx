import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { UserPlus, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/register', { email, password });
      login(res.data.token, res.data.user);
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>🔄 RevolveMail</h1>
          <p>Crie sua conta para começar</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="register-email">E-mail</label>
            <input id="register-email" type="email" className="form-input"
              placeholder="seu@email.com" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label htmlFor="register-password">Senha</label>
            <input id="register-password" type="password" className="form-input"
              placeholder="Mínimo 6 caracteres" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          <div className="form-group">
            <label htmlFor="register-confirm">Confirmar Senha</label>
            <input id="register-confirm" type="password" className="form-input"
              placeholder="Repita a senha" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? <Loader size={18} className="animate-spin" /> : <UserPlus size={18} />}
            {loading ? 'Criando...' : 'Criar Conta'}
          </button>
        </form>

        <div className="auth-link">
          Já tem uma conta? <Link to="/login">Fazer login</Link>
        </div>
      </div>
    </div>
  );
}
