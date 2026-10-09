import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import api from '../api/axiosConfig';
import type { Task, Comment, TaskHistory } from '../types';
import { useConfirm } from '../contexts/ConfirmContext';

interface TaskFull extends Task {
  comments: Comment[];
  history: TaskHistory[];
}

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  const [task, setTask] = useState<TaskFull | null>(null);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      const res = await api.get<TaskFull>(`tasks/${id}/`);
      setTask(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await api.post('comments/', { task: id, text: commentText });
    setCommentText('');
    loadTask();
  };

  const deleteTask = async () => {
    const ok = await confirm({
      title: '🗑 Удаление задачи',
      message: `Удалить задачу «${
        task?.title || ''
      }»?\n\nЭто действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'danger',
    });

    if (!ok) return;

    setDeleting(true);
    try {
      await api.delete(`tasks/${id}/`);
      navigate(-1);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Не удалось удалить задачу');
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="kb-loading">
        <span>Загрузка задачи...</span>
      </div>
    );
  if (!task) return <div className="alert alert-danger">Задача не найдена</div>;

  return (
    <div className="row">
      {/* Левая колонка */}
      <div className="col-lg-8">
        <div className="kb-fade-in">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <h2>{task.title}</h2>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={deleteTask}
              disabled={deleting}
            >
              {deleting ? 'Удаление...' : '🗑 Удалить'}
            </button>
          </div>
        </div>

        <div className="kb-card mb-4 kb-slide-up">
          <div className="card-body">
            <p>{task.description || 'Описание не заполнено'}</p>
            <hr />
            <div className="row small text-muted">
              <div className="col-md-6">
                <div className="mb-1">
                  <strong>Исполнитель:</strong>{' '}
                  {task.assignee?.username || '—'}
                </div>
                <div>
                  <strong>Приоритет:</strong>{' '}
                  <span
                    className={`badge bg-${
                      task.priority === 'high'
                        ? 'danger'
                        : task.priority === 'medium'
                        ? 'warning'
                        : 'secondary'
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-1">
                  <strong>Срок:</strong> {task.due_date || '—'}
                </div>
                <div>
                  <strong>Создана:</strong>{' '}
                  {new Date(task.created_at).toLocaleString('ru-RU')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <h4 className="kb-slide-up kb-delay-1">
          Комментарии ({task.comments.length})
        </h4>
        <div className="mb-3">
          {task.comments.map((c, i) => (
            <div
              key={c.id}
              className="kb-card mb-2 kb-slide-in-left"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="card-body py-2">
                <div className="d-flex justify-content-between">
                  <strong>{c.author.username}</strong>
                  <small className="text-muted">
                    {new Date(c.created_at).toLocaleString('ru-RU')}
                  </small>
                </div>
                <p className="mb-0 mt-2">{c.text}</p>
              </div>
            </div>
          ))}
          {task.comments.length === 0 && (
            <p className="text-muted">Пока нет комментариев</p>
          )}
        </div>

        <form onSubmit={addComment} className="kb-slide-up kb-delay-2">
          <textarea
            className="form-control mb-2"
            rows={3}
            placeholder="Написать комментарий..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Отправить
          </button>
        </form>
      </div>

      {/* Правая колонка — история */}
      <div className="col-lg-4">
        <h5 className="kb-slide-up">История изменений</h5>
        <ul className="list-group small">
          {task.history.map((h, i) => (
            <li
              key={h.id}
              className="list-group-item kb-slide-in-right"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="text-muted small">
                {new Date(h.changed_at).toLocaleString('ru-RU')}
              </div>
              <div>
                <strong>{h.user.username}</strong> изменил{' '}
                <em>{h.field_name}</em>: {h.old_value} → {h.new_value}
              </div>
            </li>
          ))}
          {task.history.length === 0 && (
            <li className="list-group-item text-muted">История пуста</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default TaskDetailPage;