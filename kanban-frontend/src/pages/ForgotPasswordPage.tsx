import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axiosConfig';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('password-reset/', { email });
      setSent(true);
      toast.success('Письмо отправлено (проверьте консоль backend)');
    } catch (err: any) {
      toast.error('Ошибка отправки');
    } finally {
      setLoading(false);
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

        <h4 className="text-center mb-3">Восстановление пароля</h4>

        {sent ? (
          <div className="alert alert-success">
            Если аккаунт с таким email существует, письмо со ссылкой уже отправлено.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-muted small mb-3">
              Введите email — мы отправим ссылку для сброса пароля.
            </p>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control form-control-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg w-100"
              disabled={loading}
            >
              {loading ? 'Отправка...' : 'Отправить'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-muted">
          <Link to="/login">← Вернуться к входу</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;