import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import api from '../api/axiosConfig';
import type { Workspace, WorkspaceMembership } from '../types';

interface TaskModalProps {
  show: boolean;
  onHide: () => void;
  columnId: number;
  workspaceId: number | null;
  onSuccess: () => void;
}

function TaskModal({ show, onHide, columnId, workspaceId, onSuccess }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [members, setMembers] = useState<WorkspaceMembership[]>([]);

  // Загрузка участников пространства
  useEffect(() => {
    if (!show || !workspaceId) return;
    api
      .get<Workspace>(`workspaces/${workspaceId}/`)
      .then((res) => setMembers(res.data.memberships || []))
      .catch(() => setMembers([]));
  }, [show, workspaceId]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && f.size > 10 * 1024 * 1024) {
      setError('Файл не должен превышать 10 МБ');
      return;
    }
    setFile(f);
    setError('');
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setAssigneeId('');
    setFile(null);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload: any = {
      column: columnId,
      title,
      description,
      priority,
      due_date: dueDate || null,
    };
    if (assigneeId !== '') payload.assignee_id = assigneeId;

    let taskId: number;
    try {
      const res = await api.post('tasks/', payload);
      taskId = res.data.id;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка создания задачи');
      setSubmitting(false);
      return;
    }

    if (file) {
      const formData = new FormData();
      formData.append('task', String(taskId));
      formData.append('file', file);
      try {
        await api.post('attachments/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err) {
        console.error('Файл не загрузился:', err);
      }
    }

    resetForm();
    setSubmitting(false);
    onSuccess();
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
                placeholder="Дополнительные детали..."
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
                  setAssigneeId(e.target.value === '' ? '' : Number(e.target.value))
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

            <div className="mb-3">
              <label className="form-label">
                Файл (PDF, PNG, JPG, ZIP — до 10 МБ)
              </label>
              <input
                type="file"
                className="form-control"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.doc,.docx,.xls,.xlsx"
              />
              {file && (
                <small className="text-muted kb-fade-in">
                  Выбран: {file.name} ({(file.size / 1024).toFixed(1)} КБ)
                </small>
              )}
            </div>
          </div>

          <div className="kb-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
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