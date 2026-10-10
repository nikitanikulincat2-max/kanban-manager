import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axiosConfig';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useAuth } from '../contexts/AuthContext';
import type {
  Task,
  Comment,
  TaskHistory,
  Attachment,
  Workspace,
  WorkspaceMembership,
  TaskGroup,
  Paginated,
  VisibilityType,
} from '../types';

interface TaskFull extends Task {
  comments: Comment[];
  history: TaskHistory[];
  attachments: Attachment[];
}

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<TaskFull | null>(null);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Поля формы редактирования
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState<number | ''>('');

  const [editVisibility, setEditVisibility] = useState<VisibilityType>('public');
  const [editGroupId, setEditGroupId] = useState<number | ''>('');
  const [editSelectedUserIds, setEditSelectedUserIds] = useState<number[]>([]);

  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      const res = await api.get<TaskFull>(`tasks/${id}/`);
      setTask(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Не удалось загрузить задачу');
    } finally {
      setLoading(false);
    }
  };

  const loadMembersAndGroups = async (wsId: number) => {
    try {
      const [wsRes, gRes] = await Promise.all([
        api.get<Workspace>(`workspaces/${wsId}/`),
        api.get<Paginated<TaskGroup> | TaskGroup[]>(`groups/?workspace=${wsId}`),
      ]);
      setMembers(wsRes.data.memberships || []);
      const list = Array.isArray(gRes.data) ? gRes.data : gRes.data.results;
      setGroups(list);
    } catch (err) {
      console.error('Не удалось загрузить участников/группы', err);
      setMembers([]);
      setGroups([]);
    }
  };

  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await api.post('comments/', { task: id, text: commentText });
      setCommentText('');
      toast.success('Комментарий добавлен');
      loadTask();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Не удалось добавить комментарий');
    }
  };

  const deleteTask = async () => {
    setDeleting(true);
    try {
      await api.delete(`tasks/${id}/`);
      toast.success('Задача удалена');
      navigate(-1);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Не удалось удалить задачу');
      setDeleting(false);
    }
  };

  const openEdit = async () => {
    if (!task) return;

    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDueDate(task.due_date || '');
    setEditAssigneeId(task.assignee?.id || '');

    setEditVisibility(task.visibility || 'public');
    setEditGroupId(task.group || '');
    setEditSelectedUserIds(
      task.visible_to_users?.map((u) => u.id) || []
    );

    setShowEdit(true);

    // Загружаем участников и группы пространства
    try {
      const colRes = await api.get(`columns/${task.column}/`);
      const boardRes = await api.get(`boards/${colRes.data.board}/`);
      const wsId = boardRes.data.workspace;
      await loadMembersAndGroups(wsId);
    } catch (err) {
      console.error('Не удалось загрузить данные пространства', err);
    }
  };

  const toggleEditUser = (userId: number) => {
    setEditSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // ─── Сохранить задачу ───────────────────────────
  const saveTask = async () => {
    if (!task) return;

    if (!editTitle.trim()) {
      toast.warn('Введите название задачи');
      return;
    }
    if (editVisibility === 'group' && !editGroupId) {
      toast.warn('Выберите группу');
      return;
    }
    if (editVisibility === 'users' && editSelectedUserIds.length === 0) {
      toast.warn('Выберите хотя бы одного пользователя');
      return;
    }

    setSaving(true);

    const payload: any = {
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      due_date: editDueDate || null,
      assignee_id: editAssigneeId === '' ? null : editAssigneeId,
      visibility: editVisibility,
      group: editVisibility === 'group' ? editGroupId : null,
      visible_to_users_ids: editVisibility === 'users' ? editSelectedUserIds : [],
    };

    try {
      await api.patch(`tasks/${id}/`, payload);
      setShowEdit(false);
      toast.success('Задача обновлена');
      loadTask();
    } catch (err: any) {
      const data = err.response?.data;
      const msg =
        data?.detail ||
        (data && typeof data === 'object'
          ? Object.values(data).flat().join(', ')
          : null) ||
        'Не удалось сохранить изменения';
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  // ─── Загрузка файла ─────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Файл не должен превышать 10 МБ');
      toast.error('Файл не должен превышать 10 МБ');
      e.target.value = '';
      return;
    }

    const allowedExtensions = [
      'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
      'zip', 'rar', '7z', 'doc', 'docx', 'xls', 'xlsx',
    ];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      setUploadError(`Формат .${ext} не поддерживается`);
      toast.error(`Формат .${ext} не поддерживается`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('task', String(id));
    formData.append('file', file);

    try {
      await api.post('attachments/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      e.target.value = '';
      toast.success('Файл загружен');
      loadTask();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.file?.[0] ||
        'Не удалось загрузить файл';
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (attachmentId: number, fileName: string) => {
    if (!window.confirm(`Удалить файл «${fileName}»?`)) return;
    try {
      await api.delete(`attachments/${attachmentId}/`);
      toast.success('Файл удалён');
      loadTask();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Не удалось удалить файл');
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return '🖼️';
    if (['zip', 'rar', '7z'].includes(ext || '')) return '📦';
    if (['doc', 'docx'].includes(ext || '')) return '📝';
    if (['xls', 'xlsx'].includes(ext || '')) return '📊';
    return '📎';
  };

  // Проверка прав на редактирование
  const canEdit = (() => {
    if (!task || !user) return false;
    if (user.is_superuser) return true;
    if (task.created_by?.id === user.id) return true;
    if (task.assignee?.id === user.id) return true;
    return false;
  })();

  if (loading) return <div className="kb-loading"><span>Загрузка задачи...</span></div>;
  if (!task) return <div className="alert alert-danger mt-5">Задача не найдена</div>;

  const priorityLabel: Record<string, string> = {
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий',
  };
  const priorityColor: Record<string, string> = {
    high: 'danger',
    medium: 'warning',
    low: 'secondary',
  };

  const visibilityIcon = {
    public: '🌐',
    private: '🔒',
    users: '👤',
    group: '👥',
  };

  return (
    <div className="row">
      {/* ═══ ЛЕВАЯ КОЛОНКА ═══ */}
      <div className="col-lg-8">
        {/* Заголовок */}
        <div className="d-flex justify-content-between align-items-start mb-4 kb-fade-in gap-3">
          <div>
            <h1 className="mb-0" style={{ fontWeight: 700, fontSize: '2rem' }}>
              {task.title}
            </h1>
            <div className="mt-2">
              <span
                className="badge bg-light text-dark"
                title={
                  task.visibility === 'public' ? 'Все участники' :
                  task.visibility === 'private' ? 'Только автор и исполнитель' :
                  task.visibility === 'users' ? 'Выбранные пользователи' :
                  `Группа: ${task.group_name || ''}`
                }
              >
                {visibilityIcon[task.visibility]} {
                  task.visibility === 'public' ? 'Все' :
                  task.visibility === 'private' ? 'Приватная' :
                  task.visibility === 'users' ? `Пользователи (${task.visible_to_users?.length || 0})` :
                  `Группа: ${task.group_name || ''}`
                }
              </span>
            </div>
          </div>
          <div className="d-flex gap-2">
            {canEdit && (
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={openEdit}
                style={{ whiteSpace: 'nowrap', marginTop: 6 }}
              >
                ✏️ Редактировать
              </button>
            )}
            {canEdit && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => setShowDeleteModal(true)}
                disabled={deleting}
                style={{ whiteSpace: 'nowrap', marginTop: 6 }}
              >
                {deleting ? 'Удаление...' : '🗑 Удалить'}
              </button>
            )}
          </div>
        </div>

        {/* Описание */}
        <div className="kb-card mb-4 kb-slide-up">
          <div style={{ padding: '28px 32px' }}>
            <h6 className="text-muted mb-3 small text-uppercase" style={{ letterSpacing: '0.05em', fontWeight: 600 }}>
              Описание
            </h6>
            <p className="mb-0" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
              {task.description || (
                <span className="text-muted fst-italic">Описание не заполнено</span>
              )}
            </p>
          </div>
        </div>

        {/* Детали */}
        <div className="kb-card mb-4 kb-slide-up kb-delay-1">
          <div style={{ padding: '28px 32px' }}>
            <h6 className="text-muted mb-3 small text-uppercase" style={{ letterSpacing: '0.05em', fontWeight: 600 }}>
              Детали
            </h6>

            <div className="row" style={{ rowGap: 20 }}>
              <div className="col-md-6">
                <div className="d-flex align-items-center" style={{ gap: 14 }}>
                  <span className="text-muted d-flex align-items-center" style={{ minWidth: 145 }}>
                    <span style={{ marginRight: 10 }}>👤</span>Исполнитель
                  </span>
                  <strong>
                    {task.assignee?.username || (
                      <span className="text-muted fst-italic">Не назначен</span>
                    )}
                  </strong>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-center" style={{ gap: 14 }}>
                  <span className="text-muted d-flex align-items-center" style={{ minWidth: 145 }}>
                    <span style={{ marginRight: 10 }}>📅</span>Срок
                  </span>
                  <span className={task.due_date && new Date(task.due_date) < new Date() ? 'text-danger fw-bold' : ''}>
                    {task.due_date || (
                      <span className="text-muted fst-italic">Не задан</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-center" style={{ gap: 14 }}>
                  <span className="text-muted d-flex align-items-center" style={{ minWidth: 145 }}>
                    <span style={{ marginRight: 10 }}>⚡</span>Приоритет
                  </span>
                  <span className={`badge bg-${priorityColor[task.priority]}`}>
                    {priorityLabel[task.priority]}
                  </span>
                </div>
              </div>

              <div className="col-md-6">
                <div className="d-flex align-items-center" style={{ gap: 14 }}>
                  <span className="text-muted d-flex align-items-center" style={{ minWidth: 145 }}>
                    <span style={{ marginRight: 10 }}>🕐</span>Создана
                  </span>
                  <span>{new Date(task.created_at).toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Файлы */}
        <div className="kb-card mb-4 kb-slide-up kb-delay-2">
          <div style={{ padding: '28px 32px' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h6 className="text-muted mb-0 small text-uppercase" style={{ letterSpacing: '0.05em', fontWeight: 600 }}>
                📎 Файлы ({task.attachments?.length || 0})
              </h6>
              <label
                className="btn btn-sm btn-outline-primary mb-0"
                style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
              >
                {uploading ? 'Загрузка...' : '+ Загрузить файл'}
                <input
                  type="file"
                  hidden
                  disabled={uploading}
                  onChange={handleFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.doc,.docx,.xls,.xlsx"
                />
              </label>
            </div>

            {uploadError && (
              <div className="alert alert-danger py-2 mb-3 kb-shake">{uploadError}</div>
            )}

            {!task.attachments || task.attachments.length === 0 ? (
              <p className="text-muted text-center mb-0 py-4">
                Файлов пока нет. Прикрепите макет, документ или архив.
              </p>
            ) : (
              <div className="row g-3">
                {task.attachments.map((att) => {
                  const fileName = att.file.split('/').pop() || 'файл';
                  return (
                    <div key={att.id} className="col-md-6">
                      <div
                        className="d-flex align-items-center"
                        style={{
                          gap: 12,
                          padding: '12px 14px',
                          border: '1px solid var(--kb-border)',
                          borderRadius: 'var(--kb-radius-sm)',
                          background: '#fafafa',
                        }}
                      >
                        <span style={{ fontSize: 28, flexShrink: 0 }}>
                          {getFileIcon(fileName)}
                        </span>
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <a
                            href={att.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="d-block text-truncate"
                            style={{ fontWeight: 500 }}
                            title={fileName}
                          >
                            {fileName}
                          </a>
                          <small className="text-muted">
                            {att.uploaded_by.username} •{' '}
                            {new Date(att.uploaded_at).toLocaleDateString('ru-RU')}
                          </small>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-danger flex-shrink-0"
                          onClick={() => deleteAttachment(att.id, fileName)}
                          title="Удалить файл"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Комментарии */}
        <div className="kb-slide-up kb-delay-3">
          <h4 className="mb-3" style={{ fontWeight: 600 }}>
            💬 Комментарии ({task.comments.length})
          </h4>

          {task.comments.length === 0 ? (
            <p className="text-muted">Пока нет комментариев. Будьте первым!</p>
          ) : (
            <div className="d-flex flex-column" style={{ gap: 14 }}>
              {task.comments.map((c, i) => (
                <div
                  key={c.id}
                  className="kb-card kb-slide-in-left"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div style={{ padding: '20px 24px' }}>
                    <div className="d-flex align-items-start" style={{ gap: 16 }}>
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: 44,
                          height: 44,
                          background: 'var(--kb-gradient)',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: 18,
                        }}
                      >
                        {c.author.username[0].toUpperCase()}
                      </div>
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                          <strong>{c.author.username}</strong>
                          <small className="text-muted">
                            {new Date(c.created_at).toLocaleString('ru-RU')}
                          </small>
                        </div>
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '1rem' }}>
                          {c.text}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="kb-card mt-3">
            <div style={{ padding: '20px 24px' }}>
              <form onSubmit={addComment}>
                <textarea
                  className="form-control mb-3"
                  rows={3}
                  placeholder="Написать комментарий..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <div className="d-flex justify-content-end">
                  <button
                    type="submit"
                    className="btn btn-primary px-4"
                    disabled={!commentText.trim()}
                  >
                    Отправить
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ПРАВАЯ КОЛОНКА — ИСТОРИЯ ═══ */}
      <div className="col-lg-4">
        <div
          className="kb-card kb-slide-up"
          style={{
            position: 'sticky',
            top: 20,
            maxHeight: 'calc(100vh - 40px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '24px 26px 12px' }}>
            <h6 className="text-muted mb-0 small text-uppercase" style={{ letterSpacing: '0.05em', fontWeight: 600 }}>
              🕐 История изменений
            </h6>
          </div>

          <div
            className="kb-history-scroll"
            style={{ padding: '0 26px 24px', overflowY: 'auto', overflowX: 'hidden', flexGrow: 1 }}
          >
            <ul className="list-unstyled mb-0">
              {task.history.length === 0 ? (
                <li className="text-muted small">История пуста</li>
              ) : (
                task.history
                  .filter((h) => {
                    const oldFields = [
                      'status',
                      'column',
                      'assignee',
                      'priority',
                      'due_date',
                      'title',
                      'description',
                      'group',
                      'visibility',
                    ];
                    if (oldFields.includes(h.field_name)) return false;

                    if (h.field_name === 'status' && h.new_value === 'created') return false;

                    return true;
                  })
                  .map((h, i, arr) => (
                    <li
                      key={h.id}
                      className="kb-slide-in-right"
                      style={{
                        animationDelay: `${i * 0.05}s`,
                        paddingBottom: i < arr.length - 1 ? 16 : 0,
                        marginBottom: i < arr.length - 1 ? 16 : 0,
                        borderBottom: i < arr.length - 1 ? '1px solid var(--kb-border)' : 'none',
                      }}
                    >
                      <div className="small text-muted mb-2">
                        {new Date(h.changed_at).toLocaleString('ru-RU')}
                      </div>
                      <div className="small" style={{ lineHeight: 1.6 }}>
                        <strong>{h.user.username}</strong> изменил{' '}
                        <em className="text-primary">{h.field_name}</em>:
                        <div
                          className="d-flex align-items-center flex-wrap"
                          style={{ gap: 6, marginTop: 8 }}
                        >
                          {h.old_value && (
                            <>
                              <span className="badge bg-light text-dark">{h.old_value}</span>
                              {h.new_value && <span className="text-muted">→</span>}
                            </>
                          )}
                          {h.new_value && (
                            <span className="badge bg-primary">{h.new_value}</span>
                          )}
                          {!h.old_value && !h.new_value && (
                            <span className="badge bg-secondary">изменено</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* ═══ МОДАЛКА РЕДАКТИРОВАНИЯ ═══ */}
      {showEdit && (
        <div className="kb-modal-backdrop" onClick={() => !saving && setShowEdit(false)}>
          <div className="kb-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h5 className="kb-modal-title">✏️ Редактировать задачу</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowEdit(false)}
                disabled={saving}
              ></button>
            </div>

            <div className="kb-modal-body">
              {/* Название */}
              <div className="mb-3">
                <label className="form-label">Название</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Описание */}
              <div className="mb-3">
                <label className="form-label">Описание</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              {/* Приоритет + срок */}
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Приоритет</label>
                  <select
                    className="form-select"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as any)}
                  >
                    <option value="low">🟦 Низкий</option>
                    <option value="medium">🟨 Средний</option>
                    <option value="high">🟥 Высокий</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Срок</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Исполнитель */}
              <div className="mb-3">
                <label className="form-label">Исполнитель</label>
                <select
                  className="form-select"
                  value={editAssigneeId}
                  onChange={(e) =>
                    setEditAssigneeId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                >
                  <option value="">— Не назначен —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.user.id}>
                      {m.user.username}
                      {m.role === 'manager' ? ' (менеджер)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* ─── ВИДИМОСТЬ ─────────────────────────── */}
              <div className="mb-3">
                <label className="form-label">Видимость задачи</label>
                <select
                  className="form-select"
                  value={editVisibility}
                  onChange={(e) => {
                    setEditVisibility(e.target.value as VisibilityType);
                    setEditGroupId('');
                    setEditSelectedUserIds([]);
                  }}
                >
                  <option value="public">🌐 Все участники пространства</option>
                  <option value="private">🔒 Только автор и исполнитель</option>
                  <option value="users">👤 Выбранные пользователи</option>
                  <option value="group">👥 Только участники группы</option>
                </select>
                <small className="text-muted d-block mt-1">
                  {editVisibility === 'public' && 'Задачу видят все участники пространства.'}
                  {editVisibility === 'private' && 'Задачу видят только вы и назначенный исполнитель.'}
                  {editVisibility === 'users' && 'Выберите, кто именно увидит эту задачу.'}
                  {editVisibility === 'group' && 'Задачу видят только участники выбранной группы.'}
                </small>
              </div>

              {/* ─── Выбор пользователей ─────────────── */}
              {editVisibility === 'users' && (
                <div className="mb-3 kb-fade-in">
                  <label className="form-label">
                    Кто увидит задачу ({editSelectedUserIds.length})
                  </label>
                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: 'auto',
                      border: '1px solid var(--kb-border)',
                      borderRadius: 'var(--kb-radius-sm)',
                      padding: 8,
                      background: '#fafafa',
                    }}
                  >
                    {members.map((m) => (
                      <label
                        key={m.id}
                        className="d-flex align-items-center gap-2 mb-1"
                        style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={editSelectedUserIds.includes(m.user.id)}
                          onChange={() => toggleEditUser(m.user.id)}
                        />
                        <span>
                          {m.user.username}
                          {m.role === 'manager' && (
                            <span className="badge bg-danger ms-2">менеджер</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  <small className="text-muted d-block mt-1">
                    Автор задачи всегда видит её, независимо от выбора.
                  </small>
                </div>
              )}

              {/* ─── Выбор группы ─────────────────────── */}
              {editVisibility === 'group' && (
                <div className="mb-3 kb-fade-in">
                  <label className="form-label">Группа *</label>
                  <select
                    className="form-select"
                    value={editGroupId}
                    onChange={(e) =>
                      setEditGroupId(e.target.value ? Number(e.target.value) : '')
                    }
                  >
                    <option value="">— Выберите группу —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.members_count} чел.)
                      </option>
                    ))}
                  </select>
                  {groups.length === 0 && (
                    <small className="text-warning d-block mt-1">
                      Групп пока нет.
                    </small>
                  )}
                </div>
              )}
            </div>

            <div className="kb-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowEdit(false)}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={saveTask}
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ МОДАЛКА УДАЛЕНИЯ — ВНЕ edit-модалки ═══ */}
      {task && (
        <ConfirmDeleteModal
          show={showDeleteModal}
          title="Удаление задачи"
          message={`Вы собираетесь удалить задачу «${task.title}».\n\nВсе комментарии, файлы и история изменений будут безвозвратно удалены.`}
          itemName={task.title}
          onConfirm={deleteTask}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}
    </div>
  );
}

export default TaskDetailPage;