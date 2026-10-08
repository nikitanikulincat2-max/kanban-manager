import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await register(username, email, password);
    if (result.ok) {
    toast.success('Регистрация успешна! Теперь войдите.');
    navigate('/login');
  } else {
    setError(result.error || 'Ошибка регистрации');
  }
  };

  return (
    <div className="kb-auth-container">
      <div className="kb-auth-card">
        <div className="kb-auth-logo">
          <span className="kb-logo-icon" style={{ background: 'var(--kb-gradient)' }}>
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
              <rect x="12" y="16" width="11" height="32" rx="3" fill="white" />
              <rect x="26.5" y="16" width="11" height="22" rx="3" fill="white" />
              <rect x="41" y="16" width="11" height="14" rx="3" fill="white" />
            </svg>
          </span>
          <span>KanBan</span>
        </div>

        <p className="text-center text-muted mb-4">Создайте новый аккаунт</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Логин</label>
            <input
              type="text"
              className="form-control form-control-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Придумайте логин"
              required
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control form-control-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="form-label">Пароль</label>
            <input
              type="password"
              className="form-control form-control-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 8 символов"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-100">
            Зарегистрироваться
          </button>
        </form>

        <p className="mt-4 text-center text-muted">
          Уже есть аккаунт?{' '}
          <Link to="/login" style={{ fontWeight: 500 }}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;