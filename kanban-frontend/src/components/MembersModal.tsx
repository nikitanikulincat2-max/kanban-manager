import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axiosConfig';
import type { Workspace, WorkspaceMembership } from '../types';
import { useConfirm } from '../contexts/ConfirmContext';

interface UserSearchResult {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface MembersModalProps {
  workspaceId: number;
  workspaceName: string;
  show: boolean;
  onHide: () => void;
}

function MembersModal({
  workspaceId,
  workspaceName,
  show,
  onHide,
}: MembersModalProps) {
  const { confirm } = useConfirm();

  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('member');
  const [inviteError, setInviteError] = useState('');
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (show) {
      loadMembers();
      setSearchQuery('');
      setSelectedUser(null);
      setSearchResults([]);
      setInviteError('');
      setInviteRole('member');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Дебаунс-поиск
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.get<UserSearchResult[]>(
          `users/search/?q=${encodeURIComponent(searchQuery)}`
        );
        const existingIds = new Set(members.map((m) => m.user.id));
        setSearchResults(res.data.filter((u) => !existingIds.has(u.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, members]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await api.get<Workspace>(`workspaces/${workspaceId}/`);
      setMembers(res.data.memberships || []);
    } catch {
      toast.error('Не удалось загрузить участников');
    } finally {
      setLoading(false);
    }
  };

  // ─── Приглашение нового участника ──────────────
  const inviteMember = async () => {
    if (!selectedUser) {
      setInviteError('Сначала выберите пользователя из списка');
      return;
    }
    setInviteError('');

    try {
      await api.post(`workspaces/${workspaceId}/add_member/`, {
        user_id: selectedUser.id,
        role: inviteRole,
      });

      const roleText = inviteRole === 'manager' ? 'менеджер' : 'участник';
      toast.success(
        `${selectedUser.username} добавлен как ${roleText}`,
        { autoClose: 2500 }
      );

      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      loadMembers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Ошибка приглашения';
      setInviteError(msg);
      toast.error(msg);
    }
  };

  // ─── Смена роли ────────────────────────────────
  const changeRole = async (
    userId: number,
    username: string,
    newRole: 'manager' | 'member'
  ) => {
    try {
      await api.post(`workspaces/${workspaceId}/add_member/`, {
        user_id: userId,
        role: newRole,
      });

      const roleText = newRole === 'manager' ? 'Менеджер' : 'Участник';
      toast.success(`${username}: роль изменена на «${roleText}»`, {
        autoClose: 2000,
      });

      loadMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка смены роли');
    }
  };

  // ─── Удаление участника ────────────────────────
  const removeMember = async (userId: number, username: string) => {
    const ok = await confirm({
      title: '🗑 Удаление участника',
      message: `Удалить ${username} из пространства «${workspaceName}»?\n\nПользователь потеряет доступ к доскам и задачам пространства.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(
        `workspaces/${workspaceId}/remove_member/?user_id=${userId}`
      );
      toast.success(`${username} удалён из пространства`);
      loadMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  if (!show) return null;

  return (
    <div className="kb-modal-backdrop" onClick={onHide}>
      <div
        className="kb-modal-content"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="kb-modal-header">
          <h5 className="kb-modal-title">
            👥 Участники пространства «{workspaceName}»
          </h5>
          <button
            type="button"
            className="btn-close"
            onClick={onHide}
          ></button>
        </div>

        {/* Тело */}
        <div className="kb-modal-body">
          {/* Форма приглашения */}
          <div
            className="kb-card mb-4 kb-slide-down"
            style={{ borderColor: 'var(--kb-primary-light)' }}
          >
            <div className="card-body">
              <label className="form-label fw-bold mb-3">
                ✉️ Пригласить пользователя
              </label>

              <div className="position-relative mb-2">
                <input
                  type="text"
                  className="form-control"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedUser(null);
                  }}
                  placeholder="Введите логин или email (мин. 2 символа)"
                />

                {searching && (
                  <div className="position-absolute top-50 end-0 translate-middle-y me-3">
                    <div
                      className="spinner-border spinner-border-sm"
                      style={{ color: 'var(--kb-primary)' }}
                    ></div>
                  </div>
                )}

                {/* Результаты поиска */}
                {searchResults.length > 0 && !selectedUser && (
                  <div
                    className="list-group position-absolute w-100 shadow-lg"
                    style={{
                      zIndex: 1000,
                      maxHeight: 250,
                      overflowY: 'auto',
                      borderRadius: 'var(--kb-radius)',
                      animation: 'kb-fadeIn 0.15s ease-out',
                    }}
                  >
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="list-group-item list-group-item-action"
                        onClick={() => {
                          setSelectedUser(u);
                          setSearchResults([]);
                          setSearchQuery(u.username);
                        }}
                      >
                        <div className="d-flex justify-content-between">
                          <span>
                            <strong>{u.username}</strong>
                            {(u.first_name || u.last_name) && (
                              <span className="text-muted ms-2">
                                {u.first_name} {u.last_name}
                              </span>
                            )}
                          </span>
                          <small className="text-muted">ID: {u.id}</small>
                        </div>
                        {u.email && (
                          <small className="text-muted d-block">
                            {u.email}
                          </small>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 &&
                  !searching &&
                  searchResults.length === 0 &&
                  !selectedUser && (
                    <div className="form-text text-muted mt-1">
                      Пользователи не найдены
                    </div>
                  )}
              </div>

              {/* Выбранный пользователь */}
              {selectedUser && (
                <div
                  className="alert alert-info py-2 mb-2 kb-scale-in-pop"
                  style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid var(--kb-primary-light)',
                    color: 'var(--kb-primary-dark)',
                  }}
                >
                  Выбран: <strong>{selectedUser.username}</strong>
                  {selectedUser.email && (
                    <span className="text-muted ms-1">
                      ({selectedUser.email})
                    </span>
                  )}
                  <button
                    className="btn btn-sm btn-link float-end p-0"
                    style={{ color: 'var(--kb-primary)' }}
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchQuery('');
                    }}
                  >
                    Отменить
                  </button>
                </div>
              )}

              {/* Роль + кнопка */}
              <div className="row g-2 align-items-end mt-2">
                <div className="col-md-8">
                  <label className="form-label small mb-1">Роль</label>
                  <select
                    className="form-select"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as 'manager' | 'member')
                    }
                  >
                    <option value="member">Участник — работа с задачами</option>
                    <option value="manager">Менеджер — полный доступ</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <button
                    className="btn btn-primary w-100"
                    onClick={inviteMember}
                    disabled={!selectedUser}
                  >
                    Пригласить
                  </button>
                </div>
              </div>

              {inviteError && (
                <div className="alert alert-danger mt-2 mb-0 py-1 kb-shake">
                  {inviteError}
                </div>
              )}
            </div>
          </div>

          {/* Список участников */}
          <h6 className="mb-3">Текущие участники ({members.length}):</h6>

          {loading ? (
            <div className="kb-loading">
              <span>Загрузка участников...</span>
            </div>
          ) : members.length === 0 ? (
            <p className="text-muted text-center py-4">
              Нет участников. Пригласите первого!
            </p>
          ) : (
            <ul className="list-group">
              {members.map((m, i) => (
                <li
                  key={m.id}
                  className="list-group-item d-flex justify-content-between align-items-center kb-member-row"
                  style={{
                    animationDelay: `${i * 0.06}s`,
                    borderRadius: 'var(--kb-radius-sm)',
                    marginBottom: 6,
                    border: '1px solid var(--kb-border)',
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <span
                      className="kb-avatar"
                      style={{
                        background: 'var(--kb-gradient)',
                        width: 40,
                        height: 40,
                        fontSize: 16,
                        border: '2px solid white',
                        boxShadow: 'var(--kb-shadow-sm)',
                      }}
                    >
                      {m.user.username[0].toUpperCase()}
                    </span>
                    <div>
                      <div>
                        <strong>{m.user.username}</strong>
                        <span
                          className={`badge ms-2 ${
                            m.role === 'manager' ? 'bg-danger' : 'bg-secondary'
                          }`}
                        >
                          {m.role === 'manager' ? 'Менеджер' : 'Участник'}
                        </span>
                      </div>
                      {m.user.email && (
                        <small className="text-muted d-block">
                          {m.user.email}
                        </small>
                      )}
                      <small className="text-muted">
                        Присоединился:{' '}
                        {new Date(m.joined_at).toLocaleDateString('ru-RU')}
                      </small>
                    </div>
                  </div>

                  <div className="d-flex gap-2 align-items-center">
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 150 }}
                      value={m.role}
                      onChange={(e) =>
                        changeRole(
                          m.user.id,
                          m.user.username,
                          e.target.value as 'manager' | 'member'
                        )
                      }
                    >
                      <option value="member">Участник</option>
                      <option value="manager">Менеджер</option>
                    </select>

                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => removeMember(m.user.id, m.user.username)}
                      title="Удалить из пространства"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Футер */}
        <div className="kb-modal-footer">
          <button className="btn btn-secondary" onClick={onHide}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

export default MembersModal;