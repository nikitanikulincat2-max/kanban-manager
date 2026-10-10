import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { FormEvent } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axiosConfig';
import type {
  Workspace,
  TaskGroup,
  WorkspaceMembership,
  Paginated,
} from '../types';
import { useWorkspaceRole } from '../hooks/useWorkspaceRole';

function GroupsPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = id ? Number(id) : null;
  const { isManager } = useWorkspaceRole(workspaceId);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);

  // Форма создания группы
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Модалка управления участниками группы
  const [manageGroup, setManageGroup] = useState<TaskGroup | null>(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadAll = async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const [wsRes, gRes] = await Promise.all([
        api.get<Workspace>(`workspaces/${workspaceId}/`),
        api.get<Paginated<TaskGroup> | TaskGroup[]>(
          `groups/?workspace=${workspaceId}`
        ),
      ]);
      setWorkspace(wsRes.data);
      setMembers(wsRes.data.memberships || []);
      const list = Array.isArray(gRes.data) ? gRes.data : gRes.data.results;
      setGroups(list);
    } catch (err) {
      console.error(err);
      toast.error('Не удалось загрузить группы');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !workspaceId) return;
    setCreating(true);
    try {
      await api.post('groups/', {
        workspace: workspaceId,
        name: newName,
        description: newDescription,
      });
      toast.success('Группа создана');
      setNewName('');
      setNewDescription('');
      setShowCreate(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (groupId: number, name: string) => {
    if (!window.confirm(`Удалить группу «${name}»?`)) return;
    try {
      await api.delete(`groups/${groupId}/`);
      toast.success('Группа удалена');
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const addMember = async (groupId: number, userId: number) => {
    try {
      await api.post(`groups/${groupId}/add_member/`, { user_id: userId });
      toast.success('Участник добавлен');
      const res = await api.get<TaskGroup>(`groups/${groupId}/`);
      setManageGroup(res.data);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка добавления');
    }
  };

  const removeMember = async (groupId: number, userId: number) => {
    try {
      await api.delete(`groups/${groupId}/remove_member/?user_id=${userId}`);
      toast.success('Участник удалён');
      const res = await api.get<TaskGroup>(`groups/${groupId}/`);
      setManageGroup(res.data);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  if (loading) {
    return <div className="kb-loading"><span>Загрузка групп...</span></div>;
  }

  return (
    <div className="kb-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="mb-0">👥 Группы</h2>
          <small className="text-muted">
            Пространство: {workspace?.name}
          </small>
        </div>
        <div className="d-flex gap-2">
          {isManager && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreate(true)}
            >
              + Создать группу
            </button>
          )}
          <Link
            to={`/workspaces/${id}`}
            className="btn btn-outline-secondary btn-sm"
          >
            ← Назад
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="kb-card p-5 text-center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <h5>Групп пока нет</h5>
          <p className="text-muted mb-0">
            Создайте группу, чтобы ограничить видимость отдельных задач
          </p>
        </div>
      ) : (
        <div className="row">
          {groups.map((g, i) => (
            <div
              key={g.id}
              className="col-md-6 col-lg-4 mb-3 kb-slide-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="kb-card h-100">
                <div style={{ padding: '20px 24px' }}>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="mb-0">{g.name}</h5>
                    <span className="badge bg-primary">{g.members_count}</span>
                  </div>

                  {g.description && (
                    <p className="text-muted small mb-3">{g.description}</p>
                  )}

                  <div className="small text-muted mb-3">
                    Создана: {g.created_by.username}
                    <br />
                    {new Date(g.created_at).toLocaleDateString('ru-RU')}
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-outline-primary flex-grow-1"
                      onClick={() => setManageGroup(g)}
                    >
                      Управлять
                    </button>
                    {isManager && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteGroup(g.id, g.name)}
                        title="Удалить группу"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка создания */}
      {showCreate && (
        <div
          className="kb-modal-backdrop"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            className="kb-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kb-modal-header">
              <h5 className="kb-modal-title">👥 Новая группа</h5>
              <button
                className="btn-close"
                onClick={() => setShowCreate(false)}
              ></button>
            </div>
            <form onSubmit={createGroup}>
              <div className="kb-modal-body">
                <div className="mb-3">
                  <label className="form-label">Название *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Например, Backend-команда"
                    required
                    autoFocus
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Описание</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Зачем эта группа?"
                  />
                </div>
              </div>
              <div className="kb-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка управления участниками группы */}
      {manageGroup && (
        <div
          className="kb-modal-backdrop"
          onClick={() => setManageGroup(null)}
        >
          <div
            className="kb-modal-content"
            style={{ maxWidth: 600 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kb-modal-header">
              <h5 className="kb-modal-title">
                👥 {manageGroup.name}
              </h5>
              <button
                className="btn-close"
                onClick={() => setManageGroup(null)}
              ></button>
            </div>
            <div className="kb-modal-body">
              <h6 className="mb-3">Участники группы:</h6>
              {manageGroup.memberships.length === 0 ? (
                <p className="text-muted">Пока никого нет</p>
              ) : (
                <ul className="list-group mb-3">
                  {manageGroup.memberships.map((m) => (
                    <li
                      key={m.id}
                      className="list-group-item d-flex justify-content-between align-items-center"
                    >
                      <span>
                        <strong>{m.user.username}</strong>
                        {m.user.email && (
                          <span className="text-muted small ms-2">
                            ({m.user.email})
                          </span>
                        )}
                      </span>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeMember(manageGroup.id, m.user.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <h6 className="mb-2">Добавить участника:</h6>
              <div className="d-flex flex-wrap gap-2">
                {members
                  .filter(
                    (wm) =>
                      !manageGroup.memberships.some(
                        (m) => m.user.id === wm.user.id
                      )
                  )
                  .map((wm) => (
                    <button
                      key={wm.id}
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => addMember(manageGroup.id, wm.user.id)}
                    >
                      + {wm.user.username}
                    </button>
                  ))}
                {members.filter(
                  (wm) =>
                    !manageGroup.memberships.some(
                      (m) => m.user.id === wm.user.id
                    )
                ).length === 0 && (
                  <span className="text-muted small">
                    Все участники пространства уже в группе
                  </span>
                )}
              </div>
            </div>
            <div className="kb-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setManageGroup(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupsPage;