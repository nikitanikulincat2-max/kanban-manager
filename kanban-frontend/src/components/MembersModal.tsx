import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axiosConfig';
import type { Workspace, WorkspaceMembership } from '../types';
import { useAuth } from '../contexts/AuthContext';

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
  const { user, refreshUser } = useAuth();
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
  }, [show]);

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

      if (user && selectedUser.id === user.id) {
        await refreshUser();
      }

      toast.success(
        `${selectedUser.username} добавлен как ${
          inviteRole === 'manager' ? 'менеджер' : 'участник'
        }`
      );

      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      loadMembers();
    } catch (err: any) {
      setInviteError(err.response?.data?.detail || 'Ошибка приглашения');
    }
  };

  const changeRole = async (userId: number, newRole: 'manager' | 'member') => {
    try {
      await api.post(`workspaces/${workspaceId}/add_member/`, {
        user_id: userId,
        role: newRole,
      });

      if (user && userId === user.id) {
        await refreshUser();
      }

      toast.success(
        `Роль изменена на ${newRole === 'manager' ? 'менеджера' : 'участника'}`
      );

      loadMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка смены роли');
    }
  };

  const removeMember = async (userId: number, username: string) => {
    if (!window.confirm(`Удалить ${username} из пространства?`)) return;
    try {
      await api.delete(
        `workspaces/${workspaceId}/remove_member/?user_id=${userId}`
      );

      if (user && userId === user.id) {
        await refreshUser();
      }

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

        <div className="kb-modal-body">
          {/* Форма приглашения */}
          <div
            className="kb-card kb-slide-down"
            style={{
              marginBottom: 24,
              borderColor: 'var(--kb-primary-light)',
              background:
                'linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(139, 92, 246, 0.06))',
            }}
          >
            <div style={{ padding: '20px 24px' }}>
              <div
                className="d-flex align-items-center"
                style={{ gap: 8, marginBottom: 16 }}
              >
                <span
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--kb-gradient)',
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    Пригласить в пространство
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--kb-text-muted)',
                    }}
                  >
                    Найдите пользователя по логину или email
                  </div>
                </div>
              </div>

              <div
                className="position-relative"
                style={{ marginBottom: 14 }}
              >
                <input
                  type="text"
                  className="form-control form-control-lg"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedUser(null);
                  }}
                  placeholder="Логин или email..."
                  style={{ paddingLeft: 44 }}
                />

                <span
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--kb-text-muted)',
                    pointerEvents: 'none',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>

                {searching && (
                  <div
                    className="position-absolute top-50 end-0 translate-middle-y"
                    style={{ right: 14 }}
                  >
                    <div
                      className="spinner-border spinner-border-sm"
                      style={{ color: 'var(--kb-primary)' }}
                    ></div>
                  </div>
                )}

                {searchResults.length > 0 && !selectedUser && (
                  <div
                    className="list-group position-absolute w-100 shadow-lg"
                    style={{
                      zIndex: 1000,
                      maxHeight: 280,
                      overflowY: 'auto',
                      top: 'calc(100% + 6px)',
                      borderRadius: 'var(--kb-radius)',
                      animation: 'kb-fadeIn 0.15s ease-out',
                      border: '1px solid var(--kb-border)',
                    }}
                  >
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="list-group-item list-group-item-action d-flex align-items-center"
                        style={{ gap: 12, padding: '12px 16px' }}
                        onClick={() => {
                          setSelectedUser(u);
                          setSearchResults([]);
                          setSearchQuery(u.username);
                        }}
                      >
                        <span
                          className="d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'var(--kb-gradient)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          {u.username[0].toUpperCase()}
                        </span>
                        <div
                          className="flex-grow-1 text-start"
                          style={{ minWidth: 0 }}
                        >
                          <div style={{ fontWeight: 500 }}>{u.username}</div>
                          {u.email && (
                            <small className="text-muted d-block text-truncate">
                              {u.email}
                            </small>
                          )}
                        </div>
                        <small className="text-muted flex-shrink-0">
                          ID: {u.id}
                        </small>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 &&
                  !searching &&
                  searchResults.length === 0 &&
                  !selectedUser && (
                    <div
                      className="text-center"
                      style={{
                        marginTop: 10,
                        fontSize: '0.85rem',
                        color: 'var(--kb-text-muted)',
                      }}
                    >
                      Пользователи не найдены
                    </div>
                  )}
              </div>

              {selectedUser && (
                <div
                  className="d-flex align-items-center kb-scale-in-pop"
                  style={{
                    gap: 12,
                    padding: '12px 16px',
                    marginBottom: 14,
                    background: 'white',
                    border: '2px solid var(--kb-primary)',
                    borderRadius: 'var(--kb-radius-sm)',
                  }}
                >
                  <span
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--kb-gradient)',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {selectedUser.username[0].toUpperCase()}
                  </span>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {selectedUser.username}
                    </div>
                    {selectedUser.email && (
                      <small className="text-muted d-block text-truncate">
                        {selectedUser.email}
                      </small>
                    )}
                  </div>
                  <button
                    className="btn btn-sm btn-outline-secondary flex-shrink-0"
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchQuery('');
                    }}
                    title="Отменить выбор"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="row g-3">
                <div className="col-md-7">
                  <label
                    className="form-label"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      color: 'var(--kb-text-muted)',
                      marginBottom: 6,
                    }}
                  >
                    Роль в пространстве
                  </label>
                  <select
                    className="form-select"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as 'manager' | 'member')
                    }
                  >
                    <option value="member">
                      Участник — работа с задачами
                    </option>
                    <option value="manager">
                      Менеджер — полный доступ
                    </option>
                  </select>
                </div>

                <div className="col-md-5 d-flex align-items-end">
                  <button
                    className="btn btn-primary w-100"
                    onClick={inviteMember}
                    disabled={!selectedUser}
                    style={{ height: 42 }}
                  >
                    {selectedUser ? '✓ Пригласить' : 'Пригласить'}
                  </button>
                </div>
              </div>

              {inviteError && (
                <div
                  className="alert alert-danger kb-shake"
                  style={{
                    marginTop: 14,
                    marginBottom: 0,
                    padding: '10px 14px',
                  }}
                >
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
                            m.role === 'manager'
                              ? 'bg-danger'
                              : 'bg-secondary'
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
                          e.target.value as 'manager' | 'member'
                        )
                      }
                    >
                      <option value="member">Участник</option>
                      <option value="manager">Менеджер</option>
                    </select>

                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() =>
                        removeMember(m.user.id, m.user.username)
                      }
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