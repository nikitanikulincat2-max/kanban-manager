import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import type { Workspace, Paginated } from '../types';
import { useAuth } from '../contexts/AuthContext';

function WorkspaceListPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const res = await api.get<Paginated<Workspace> | Workspace[]>(
        'workspaces/'
      );
      const list = Array.isArray(res.data) ? res.data : res.data.results;
      setWorkspaces(list);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Не удалось загрузить пространства');
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    try {
      await api.post('workspaces/', { name });
      setName('');
      loadWorkspaces();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка создания пространства');
    }
  };

  if (loading) return <div className="kb-loading"><span>Загрузка пространств...</span></div>;

  const canCreate = user?.is_superuser || user?.is_manager;

  return (
    <div className="kb-fade-in">
      <h2 className="mb-4" style={{ fontWeight: 700 }}>
        Мои пространства
      </h2>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Форма создания — только для менеджеров */}
      {canCreate ? (
        <form onSubmit={createWorkspace} className="mb-4 d-flex gap-2">
          <input
            className="form-control form-control-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название нового пространства"
            required
          />
          <button type="submit" className="btn btn-primary btn-lg px-4">
            + Создать
          </button>
        </form>
      ) : (
        <div className="alert alert-info kb-slide-up">
          🔒 Создавать пространства может только пользователь с ролью{' '}
          <strong>«Менеджер»</strong>. Обратитесь к администратору, чтобы
          получить эту роль.
        </div>
      )}

      {/* Список пространств */}
      {workspaces.length === 0 ? (
        <div className="kb-card p-5 text-center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h5>Пока нет ни одного пространства</h5>
          <p className="text-muted mb-0">
            {canCreate
              ? 'Создайте первое пространство для работы с задачами'
              : 'Вы ещё не добавлены ни в одно пространство. Попросите менеджера пригласить вас.'}
          </p>
        </div>
      ) : (
        <div className="row">
          {workspaces.map((w, i) => (
            <div
              key={w.id}
              className="col-md-6 col-lg-4 mb-3 kb-slide-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <Link
                to={`/workspaces/${w.id}`}
                className="text-decoration-none text-dark"
              >
                <div className="kb-card kb-card-hover p-4 h-100">
                  <div className="d-flex align-items-center gap-3 mb-2">
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--kb-gradient)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 18,
                      }}
                    >
                      {w.name[0]?.toUpperCase()}
                    </div>
                    <h5 className="mb-0" style={{ fontWeight: 600 }}>
                      {w.name}
                    </h5>
                  </div>
                  {w.memberships && (
                    <small className="text-muted">
                      👥 {w.memberships.length}{' '}
                      {w.memberships.length === 1 ? 'участник' : 'участников'}
                    </small>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkspaceListPage;