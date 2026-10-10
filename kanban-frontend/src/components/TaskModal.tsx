import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import api from '../api/axiosConfig';
import type {
  Workspace,
  WorkspaceMembership,
  TaskGroup,
  Paginated,
  VisibilityType,
} from '../types';

interface TaskModalProps {
  show: boolean;
  onHide: () => void;
  columnId: number;
  workspaceId: number;
  onSuccess: () => void;
}

function TaskModal({ show, onHide, columnId, workspaceId, onSuccess }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [visibility, setVisibility] = useState<VisibilityType>('public');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);

  useEffect(() => {
    if (show && workspaceId) {
      api.get<Workspace>(`workspaces/${workspaceId}/`)
        .then((res) => setMembers(res.data.memberships || []))
        .catch(console.error);

      api.get<Paginated<TaskGroup> | TaskGroup[]>(`groups/?workspace=${workspaceId}`)
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : res.data.results;
          setGroups(list);
        })
        .catch(console.error);
    }
  }, [show, workspaceId]);

  useEffect(() => {
    if (!show) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setAssigneeId('');
      setVisibility('public');
      setGroupId('');
      setError('');
      setSubmitting(false);
    }
  }, [show]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (visibility === 'group' && !groupId) {
      setError('Выберите группу или измените видимость');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('tasks/', {
        column: columnId,
        title,
        description,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
        visibility,
        group: visibility === 'group' ? groupId : null,
      });
      setSubmitting(false);
      onSuccess();
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data) ||
        'Ошибка создания задачи'
      );
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="kb-modal-backdrop" onClick={onHide}>
      <div className="kb-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="kb-modal-header">
          <h5 className="kb-modal-title">✨ Новая задача</h5>
          <button type="button" className="btn-close" onClick={onHide}></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="kb-modal-body">
            {error && <div className="alert alert-danger kb-fade-in">{error}</div>}

            <div className="mb-3">
              <label className="form-label">Заголовок *</label>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Что нужно сделать?"
                required
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Описание</label>
              <textarea
                className="form-control"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Приоритет</label>
                <select
                  className="form-select"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as 'low' | 'medium' | 'high')
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
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Исполнитель</label>
              <select
                className="form-select"
                value={assigneeId}
                onChange={(e) =>
                  setAssigneeId(e.target.value ? Number(e.target.value) : '')
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

            {/* ─── Видимость ─── */}
            <div className="mb-3">
              <label className="form-label">Видимость задачи</label>
              <select
                className="form-select"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as VisibilityType);
                  if (e.target.value !== 'group') setGroupId('');
                }}
              >
                <option value="public">🌐 Все участники пространства</option>
                <option value="private">🔒 Только автор и исполнитель</option>
                <option value="group">👥 Только участники группы</option>
              </select>
              <small className="text-muted d-block mt-1">
                {visibility === 'public' && 'Задачу видят все, кто состоит в пространстве.'}
                {visibility === 'private' && 'Задачу видите только вы и назначенный исполнитель.'}
                {visibility === 'group' && 'Задачу видят только участники выбранной группы.'}
              </small>
            </div>

            {/* ─── Выбор группы ─── */}
            {visibility === 'group' && (
              <div className="mb-3 kb-fade-in">
                <label className="form-label">Группа *</label>
                <select
                  className="form-select"
                  value={groupId}
                  onChange={(e) =>
                    setGroupId(e.target.value ? Number(e.target.value) : '')
                  }
                  required
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
                    Групп пока нет. Создайте группу в настройках пространства.
                  </small>
                )}
              </div>
            )}
          </div>

          <div className="kb-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onHide}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Создание...' : 'Создать задачу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskModal;