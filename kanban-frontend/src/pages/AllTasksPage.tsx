import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import type { Task, Paginated } from '../types';

function AllTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortBy, setSortBy] = useState('-created_at');

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, priorityFilter, sortBy]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (sortBy) params.append('ordering', sortBy);

      const res = await api.get<Paginated<Task> | Task[]>(
        `tasks/?${params.toString()}`
      );
      const list = Array.isArray(res.data) ? res.data : res.data.results;
      setTasks(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return <div className="kb-loading"><span>Загрузка задач...</span></div>;
  }

  return (
    <div className="kb-fade-in">
      <h2 className="mb-4" style={{ fontWeight: 700 }}>
        📋 Все задачи
      </h2>

      {/* Панель фильтров */}
      <div className="kb-card mb-4 kb-slide-up">
        <div style={{ padding: '20px 24px' }}>
          <div className="row g-3">
            <div className="col-md-5">
              <label className="form-label small mb-1">Поиск</label>
              <input
                type="text"
                className="form-control"
                placeholder="Название или описание..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">Приоритет</label>
              <select
                className="form-select"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">Все</option>
                <option value="high">Высокий</option>
                <option value="medium">Средний</option>
                <option value="low">Низкий</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-1">Сортировка</label>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="-created_at">Сначала новые</option>
                <option value="created_at">Сначала старые</option>
                <option value="due_date">По сроку</option>
                <option value="-priority">По приоритету</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Список задач */}
      {tasks.length === 0 ? (
        <div className="kb-card p-5 text-center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h5>Задачи не найдены</h5>
          <p className="text-muted mb-0">
            Измените фильтры или создайте новую задачу на доске
          </p>
        </div>
      ) : (
        <div className="d-flex flex-column" style={{ gap: 12 }}>
          {tasks.map((task, i) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="text-decoration-none text-dark kb-slide-up"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <div className="kb-card kb-card-hover">
                <div style={{ padding: '16px 20px' }}>
                  <div className="d-flex justify-content-between align-items-start gap-3">
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <h6 className="mb-1" style={{ fontWeight: 600 }}>
                        {task.title}
                      </h6>
                      {task.description && (
                        <p
                          className="text-muted small mb-2"
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {task.description}
                        </p>
                      )}
                      <div className="d-flex align-items-center gap-3 small text-muted flex-wrap">
                        <span>
                          👤 {task.assignee?.username || 'Без исполнителя'}
                        </span>
                        {task.due_date && <span>📅 {task.due_date}</span>}
                        {task.comments_count > 0 && (
                          <span>💬 {task.comments_count}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`badge bg-${priorityColor[task.priority]} flex-shrink-0`}
                    >
                      {priorityLabel[task.priority]}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default AllTasksPage;