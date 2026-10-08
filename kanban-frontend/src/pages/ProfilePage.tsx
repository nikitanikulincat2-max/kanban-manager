import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { useAuth } from '../contexts/AuthContext';

interface UserInfo {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser?: boolean;
}

interface AllUser {
  id: number;
  username: string;
  email: string;
}

function ProfilePage() {
  const { user, logout } = useAuth();
  const [me, setMe] = useState<UserInfo | null>(null);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [showSwitch, setShowSwitch] = useState(false);
  const [switchUsername, setSwitchUsername] = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    loadMe();
    loadAllUsers();
  }, []);

  const loadMe = async () => {
    try {
      const res = await api.get<UserInfo>('users/me/');
      setMe(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await api.get<AllUser[]>('users/');
      setAllUsers(res.data);
    } catch {
      setAllUsers([]);
    }
  };

  const handleSwitch = async () => {
    if (!switchUsername.trim() || !switchPassword.trim()) {
      setSwitchError('Заполните оба поля');
      return;
    }
    setSwitching(true);
    setSwitchError('');
    try {
      const tokenRes = await api.post('token/', {
        username: switchUsername,
        password: switchPassword,
      });

      localStorage.setItem('access_token', tokenRes.data.access);
      localStorage.setItem('refresh_token', tokenRes.data.refresh);
      localStorage.removeItem('user');
      window.location.href = '/workspaces';
    } catch (err: any) {
      setSwitchError(
        err.response?.data?.detail || 'Неверный логин или пароль'
      );
      setSwitching(false);
    }
  };

  const quickSwitch = (username: string) => {
    setSwitchUsername(username);
    setSwitchPassword('');
    setShowSwitch(true);
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        {/* ─── Профиль ───────────────────────────── */}
        <div className="card mb-4">
          <div className="card-body text-center">
            <div
              className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 80, height: 80, fontSize: 32 }}
            >
              {me?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <h3>{me?.username || user?.username}</h3>
            {me?.email && <p className="text-muted mb-0">{me.email}</p>}
            {(me?.first_name || me?.last_name) && (
              <p className="text-muted">
                {me.first_name} {me.last_name}
              </p>
            )}
            <p className="text-muted small">ID: {me?.id}</p>

            <div className="d-flex gap-2 justify-content-center mt-3">
              <button
                className="btn btn-outline-primary"
                onClick={() => setShowSwitch(!showSwitch)}
              >
                🔄 Сменить пользователя
              </button>
              <button className="btn btn-outline-danger" onClick={logout}>
                Выйти
              </button>
            </div>
          </div>
        </div>

        {/* ─── Форма смены пользователя ─────────── */}
        {showSwitch && (
          <div className="card mb-4 border-primary">
            <div className="card-header bg-primary text-white">
              Смена пользователя
            </div>
            <div className="card-body">
              <p className="text-muted small">
                Введите логин и пароль другого пользователя — вы мгновенно
                переключитесь на его аккаунт (без выхода из системы).
              </p>

              {switchError && (
                <div className="alert alert-danger py-1">{switchError}</div>
              )}

              <div className="mb-2">
                <label className="form-label small">Логин</label>
                <input
                  type="text"
                  className="form-control"
                  value={switchUsername}
                  onChange={(e) => setSwitchUsername(e.target.value)}
                  placeholder="Логин другого пользователя"
                />
              </div>

              <div className="mb-3">
                <label className="form-label small">Пароль</label>
                <input
                  type="password"
                  className="form-control"
                  value={switchPassword}
                  onChange={(e) => setSwitchPassword(e.target.value)}
                  placeholder="Пароль"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSwitch();
                  }}
                />
              </div>

              <button
                className="btn btn-primary w-100"
                onClick={handleSwitch}
                disabled={switching}
              >
                {switching ? 'Переключаем...' : 'Сменить пользователя'}
              </button>

              {/* Быстрый выбор из списка (только для администратора системы) */}
              {allUsers.length > 0 && (
                <div className="mt-4">
                  <label className="form-label small text-muted">
                    Быстрый выбор из списка (только для администратора системы)
                  </label>
                  <div className="d-flex flex-wrap gap-2">
                    {allUsers
                      .filter((u) => u.username !== me?.username)
                      .map((u) => (
                        <button
                          key={u.id}
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => quickSwitch(u.username)}
                          title={u.email}
                        >
                          {u.username}
                        </button>
                      ))}
                  </div>
                  <small className="text-muted d-block mt-2">
                    Клик — подставить логин. Пароль введите вручную.
                  </small>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Справка по ролям ────────────────── */}
        <div className="card">
          <div className="card-header">Справка по ролям</div>
          <div className="card-body">
            <ul className="mb-0 small">
              <li className="mb-2">
                <strong>Менеджер</strong> — создаёт пространства, доски и колонки,
                приглашает участников и управляет их ролями.
              </li>
              <li className="mb-2">
                <strong>Участник</strong> — создаёт задачи, комментирует,
                перемещает карточки между колонками, редактирует свои задачи.
              </li>
              <li>
                <strong>Администратор системы</strong> — глобальная роль,
                управляет всеми пользователями и пространствами через
                Django-админку.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;