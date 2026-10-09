import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { FormEvent} from 'react';
import api from '../api/axiosConfig';
import type { Task, Comment, TaskHistory, Workspace, WorkspaceMembership } from '../types';

interface TaskFull extends Task {
  comments: Comment[];
  history: TaskHistory[];
}

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<TaskFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Комментарии
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Модалки
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Поля формы редактирования
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState<number | ''>('');
  const [editError, setEditError] = useState('');

  // Участники пространства для выбора исполнителя
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      setLoading(true);
      const res = await api.get<TaskFull>(`tasks/${id}/`);
      setTask(res.data);

      // Загружаем участников пространства (для выбора исполнителя)
      const columnId = res.data.column;
      if (columnId) {
        const columnRes = await api.get(`columns/${columnId}/`);
        const boardId = columnRes.data.board;
        const boardRes = await api.get(`boards/${boardId}/`);
        const workspaceId = boardRes.data.workspace;
        const wsRes = await api.get<Workspace>(`workspaces/${workspaceId}/`);
        setMembers(wsRes.data.memberships || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Задача не найдена');
    } finally {
      setLoading(false);
    }
  };

  // ─── Открыть модалку редактирования ─────────────
  const openEditModal = () => {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDueDate(task.due_date || '');
    setEditAssigneeId(task.assignee?.id || '');
    setEditError('');
    setShowEditModal(true);
  };

  // ─── Сохранить изменения задачи ─────────────────
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setEditError('');
    setSaving(true);

    try {
      await api.patch(`tasks/${task.id}/`, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        due_date: editDueDate || null,
        assignee_id: editAssigneeId || null,
      });
      setShowEditModal(false);
      await loadTask();
    } catch (err: any) {
      setEditError(
        err.response?.data?.detail ||
          JSON.stringify(err.response?.data) ||
          'Ошибка сохранения'
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── Открыть модалку удаления ───────────────────
  const openDeleteModal = () => {
    setShowDeleteModal(true);
  };

  // ─── Подтвердить удаление ───────────────────────
  const confirmDelete = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await api.delete(`tasks/${task.id}/`);
      // Возвращаемся на доску
      const columnRes = await api.get(`columns/${task.column}/`);
      const boardId = columnRes.data.board;
      navigate(`/boards/${boardId}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Не удалось удалить задачу');
      setDeleting(false);
    }
  };

  // ─── Добавить комментарий ───────────────────────
  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !task) return;
    setSendingComment(true);
    try {
      await api.post('comments/', { task: task.id, text: commentText });
      setCommentText('');
      await loadTask();
    } catch (err) {
      console.error(err);
    } finally {
      setSendingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="kb-loading">
        <span>Загрузка задачи...</span>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div>
        <div className="alert alert-danger">{error || 'Задача не найдена'}</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Назад
        </button>
      </div>
    );
  }

  return (
    <div className="row">
      {/* ═══ ЛЕВАЯ КОЛОНКА ═══ */}
      <div className="col-lg-8">
        {/* Заголовок + действия */}
        <div className="d-flex justify-content-between align-items-start mb-3 kb-fade-in flex-wrap gap-2">
          <h2 className="mb-0">{task.title}</h2>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={openEditModal}
            >
              ✏️ Редактировать
            </button>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={openDeleteModal}
            >
              🗑 Удалить
            </button>
          </div>
        </div>

        {/* Описание */}
        <div className="kb-card mb-4 kb-slide-up">
          <div className="card-body">
            <h6 className="text-muted mb-2 small">ОПИСАНИЕ</h6>
            <p className="mb-0">
              {task.description || 'Описание не заполнено'}
            </p>
          </div>
        </div>

        {/* Детали */}
        <div className="kb-card mb-4 kb-slide-up kb-delay-1">
          <div className="card-body">
            <h6 className="text-muted mb-3 small">ДЕТАЛИ</h6>
            <div className="row g-3">
              <div className="col-md-6">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span>👤</span>
                  <span className="text-muted small">Исполнитель</span>
                </div>
                <strong>
                  {task.assignee?.username || 'Не назначен'}
                </strong>
              </div>
              <div className="col-md-6">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span>📅</span>
                  <span className="text-muted small">Срок</span>
                </div>
                <strong>
                  {task.due_date
                    ? new Date(task.due_date).toLocaleDateString('ru-RU')
                    : 'Не задан'}
                </strong>
              </div>
              <div className="col-md-6">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span>⚡</span>
                  <span className="text-muted small">Приоритет</span>
                </div>
                <span
                  className={`badge bg-${
                    task.priority === 'high'
                      ? 'danger'
                      : task.priority === 'medium'
                      ? 'warning'
                      : 'secondary'
                  }`}
                >
                  {task.priority === 'high'
                    ? 'Высокий'
                    : task.priority === 'medium'
                    ? 'Средний'
                    : 'Низкий'}
                </span>
              </div>
              <div className="col-md-6">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span>🕐</span>
                  <span className="text-muted small">Создана</span>
                </div>
                <strong>
                  {new Date(task.created_at).toLocaleString('ru-RU')}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Комментарии */}
        <h4 className="kb-slide-up kb-delay-2">
          💬 Комментарии ({task.comments.length})
        </h4>
        <div className="mb-3">
          {task.comments.map((c, i) => (
            <div
              key={c.id}
              className="kb-card mb-2 kb-slide-in-left"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <strong>{c.author.username}</strong>
                  <small className="text-muted">
                    {new Date(c.created_at).toLocaleString('ru-RU')}
                  </small>
                </div>
                <p className="mb-0">{c.text}</p>
              </div>
            </div>
          ))}
          {task.comments.length === 0 && (
            <p className="text-muted">Пока нет комментариев. Будьте первым!</p>
          )}
        </div>

        <form onSubmit={addComment} className="kb-slide-up kb-delay-3">
          <textarea
            className="form-control mb-2"
            rows={3}
            placeholder="Написать комментарий..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sendingComment || !commentText.trim()}
          >
            {sendingComment ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </div>

      {/* ═══ ПРАВАЯ КОЛОНКА — ИСТОРИЯ ═══ */}
      <div className="col-lg-4">
        <div className="kb-card kb-slide-up">
          <div className="card-body">
            <h6 className="text-muted mb-3 small">🕐 ИСТОРИЯ ИЗМЕНЕНИЙ</h6>
            {task.history.length === 0 ? (
              <p className="text-muted small mb-0">История пуста</p>
            ) : (
              <ul className="list-unstyled mb-0">
                {task.history.map((h, i) => (
                  <li
                    key={h.id}
                    className="mb-3 pb-3 kb-slide-in-right"
                    style={{
                      animationDelay: `${i * 0.05}s`,
                      borderBottom:
                        i < task.history.length - 1
                          ? '1px solid var(--kb-border)'
                          : 'none',
                    }}
                  >
                    <div className="text-muted small mb-1">
                      {new Date(h.changed_at).toLocaleString('ru-RU')}
                    </div>
                    <div className="small">
                      <strong>{h.user.username}</strong> изменил{' '}
                      <em>{h.field_name}</em>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ═══ МОДАЛКА РЕДАКТИРОВАНИЯ ═══ */}
      {showEditModal && (
        <div
          className="kb-modal-backdrop"
          onClick={() => !saving && setShowEditModal(false)}
        >
          <div
            className="kb-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kb-modal-header">
              <h5 className="kb-modal-title">✏️ Редактировать задачу</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowEditModal(false)}
                disabled={saving}
              ></button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="kb-modal-body">
                {editError && (
                  <div className="alert alert-danger kb-fade-in">
                    {editError}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label">Заголовок *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Описание</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Приоритет</label>
                    <select
                      className="form-select"
                      value={editPriority}
                      onChange={(e) =>
                        setEditPriority(
                          e.target.value as 'low' | 'medium' | 'high'
                        )
                      }
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

                <div className="mb-3">
                  <label className="form-label">Исполнитель</label>
                  <select
                    className="form-select"
                    value={editAssigneeId}
                    onChange={(e) =>
                      setEditAssigneeId(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                  >
                    <option value="">— Без исполнителя —</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.user.id}>
                        {m.user.username}
                        {m.role === 'manager' ? ' (менеджер)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="kb-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ МОДАЛКА УДАЛЕНИЯ ═══ */}
      {showDeleteModal && (
        <div
          className="kb-modal-backdrop"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="kb-modal-content"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kb-modal-header">
              <h5
                className="kb-modal-title"
                style={{ color: 'var(--kb-danger)' }}
              >
                🗑 Удалить задачу?
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              ></button>
            </div>

            <div className="kb-modal-body">
              <p className="mb-2">
                Вы собираетесь удалить задачу:
              </p>
              <div
                className="p-3 mb-3"
                style={{
                  background: '#f9fafb',
                  borderLeft: '4px solid var(--kb-danger)',
                  borderRadius: 'var(--kb-radius-sm)',
                }}
              >
                <strong>{task.title}</strong>
              </div>
              <p className="text-muted small mb-0">
                <strong>Внимание:</strong> Это действие нельзя отменить. Все
                комментарии и история изменений этой задачи будут удалены
                безвозвратно.
              </p>
            </div>

            <div className="kb-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Удаление...' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskDetailPage;