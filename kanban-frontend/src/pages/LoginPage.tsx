import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setError('');
  try {
    const ok = await login(username, password);
    if (ok) {
      navigate('/workspaces');
    }
  } catch (err: any) {
    const status = err.response?.status;

    if (status === 401) {
      setError('Неверный логин или пароль');
    } else if (status === 403 || status === 429) {
      setError(
        '⛔ Слишком много попыток входа. Подождите минуту и попробуйте снова.'
      );
    } else if (status === 400) {
      setError('Укажите логин и пароль');
    } else {
      setError('Ошибка соединения. Проверьте интернет и попробуйте позже.');
    }
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

        <p className="text-center text-muted mb-4">
          Войдите, чтобы продолжить работу
        </p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Логин</label>
            <input
              type="text"
              className="form-control form-control-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин"
              required
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="form-label">Пароль</label>
            <input
              type="password"
              className="form-control form-control-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-100">
            Войти
          </button>
        </form>

        <p className="text-center mb-3">
          <Link to="/forgot-password" className="small text-muted">
            Забыли пароль?
          </Link>
        </p>

        <p className="mt-4 text-center text-muted">
          Нет аккаунта?{' '}
          <Link to="/register" style={{ fontWeight: 500 }}>
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;