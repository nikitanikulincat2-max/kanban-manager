import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import type { Task, Column, Board, Workspace, Paginated } from '../types';

interface TaskWithContext extends Task {
  columnName: string;
  boardId: number;
  boardName: string;
  workspaceName: string;
}

function AllTasksPage() {
  const [tasks, setTasks] = useState<TaskWithContext[]>([]);
  const [loading, setLoading] = useState(true);

  // Фильтры
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState('-created_at');

  // Мобильное сворачивание фильтров
  const [showFilters, setShowFilters] = useState(false);

  // Для контекста — какие доски/пространства/исполнители существуют
  const [columns, setColumns] = useState<Column[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; username: string }[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, priorityFilter, assigneeFilter, workspaceFilter, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Параллельно загружаем всё нужное
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (assigneeFilter) params.append('assignee', assigneeFilter);
      if (sortBy) params.append('ordering', sortBy);

      const [tRes, cRes, bRes, wRes] = await Promise.all([
        api.get<Paginated<Task> | Task[]>(`tasks/?${params.toString()}`),
        api.get<Paginated<Column> | Column[]>('columns/'),
        api.get<Paginated<Board> | Board[]>('boards/'),
        api.get<Paginated<Workspace> | Workspace[]>('workspaces/'),
      ]);

      const tasksList = Array.isArray(tRes.data) ? tRes.data : tRes.data.results;
      const columnsList = Array.isArray(cRes.data) ? cRes.data : cRes.data.results;
      const boardsList = Array.isArray(bRes.data) ? bRes.data : bRes.data.results;
      const wsList = Array.isArray(wRes.data) ? wRes.data : wRes.data.results;

      setColumns(columnsList);
      setBoards(boardsList);
      setWorkspaces(wsList);

      // Обогащаем задачи контекстом
      const enriched: TaskWithContext[] = tasksList.map((t) => {
        const col = columnsList.find((c) => c.id === t.column);
        const board = col ? boardsList.find((b) => b.id === col.board) : null;
        const ws = board ? wsList.find((w) => w.id === board.workspace) : null;
        return {
          ...t,
          columnName: col?.name || '—',
          boardId: board?.id || 0,
          boardName: board?.name || '—',
          workspaceName: ws?.name || '—',
        };
      });

      // Фильтр по пространству на клиенте (после обогащения)
      const filteredByWorkspace =
        workspaceFilter === 'all'
          ? enriched
          : enriched.filter((t) => t.workspaceName === String(workspaceFilter));

      setTasks(filteredByWorkspace);

      // Уникальные исполнители
      const usersSet = new Map<number, { id: number; username: string }>();
      tasksList.forEach((t) => {
        if (t.assignee) {
          usersSet.set(t.assignee.id, {
            id: t.assignee.id,
            username: t.assignee.username,
          });
        }
      });
      setAllUsers(Array.from(usersSet.values()));
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
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

  const hasActiveFilters =
    search !== '' ||
    priorityFilter !== '' ||
    assigneeFilter !== '' ||
    workspaceFilter !== 'all' ||
    sortBy !== '-created_at';

  const resetFilters = () => {
    setSearch('');
    setPriorityFilter('');
    setAssigneeFilter('');
    setWorkspaceFilter('all');
    setSortBy('-created_at');
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="kb-loading">
        <span>Загрузка задач...</span>
      </div>
    );
  }

  return (
    <div className="kb-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h2 className="mb-0" style={{ fontWeight: 700 }}>
          📋 Все задачи
        </h2>
        <span className="text-muted small">
          Найдено: <strong>{tasks.length}</strong>
        </span>
      </div>

      {/* Мобильная кнопка фильтров */}
      <button
        className="kb-filters-toggle"
        onClick={() => setShowFilters(!showFilters)}
      >
        🔍 Фильтры
        {hasActiveFilters && (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--kb-danger)',
              marginLeft: 6,
              verticalAlign: 'middle',
            }}
          />
        )}
        <span style={{ float: 'right' }}>{showFilters ? '▲' : '▼'}</span>
      </button>

      {/* Фильтры */}
      <div className={`kb-filters-panel ${showFilters ? 'is-open' : ''}`}>
        <div className="kb-card mb-4 kb-slide-up">
          <div style={{ padding: '20px 24px' }}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label small mb-1">Поиск</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Название или описание..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-md-2">
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

              <div className="col-md-2">
                <label className="form-label small mb-1">Исполнитель</label>
                <select
                  className="form-select"
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                >
                  <option value="">Все</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label small mb-1">Пространство</label>
                <select
                  className="form-select"
                  value={workspaceFilter}
                  onChange={(e) =>
                    setWorkspaceFilter(
                      e.target.value === 'all' ? 'all' : Number(e.target.value)
                    )
                  }
                >
                  <option value="all">Все</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
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

            {hasActiveFilters && (
              <div className="mt-3">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={resetFilters}
                >
                  ✕ Сбросить фильтры
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Список задач */}
      {tasks.length === 0 ? (
        <div className="kb-card p-5 text-center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h5>
            {hasActiveFilters
              ? 'По вашим фильтрам ничего не найдено'
              : 'У вас пока нет задач'}
          </h5>
          <p className="text-muted mb-0">
            {hasActiveFilters
              ? 'Измените фильтры или сбросьте их'
              : 'Создайте задачу на любой доске'}
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
                          📂 {task.workspaceName} / {task.boardName} →{' '}
                          {task.columnName}
                        </span>
                        <span>
                          👤 {task.assignee?.username || 'Без исполнителя'}
                        </span>
                        {task.due_date && <span>📅 {task.due_date}</span>}
                        {task.comments_count > 0 && (
                          <span>💬 {task.comments_count}</span>
                        )}
                      </div>
                    </div>

                    <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
                      <span className={`badge bg-${priorityColor[task.priority]}`}>
                        {priorityLabel[task.priority]}
                      </span>
                      {task.due_date && new Date(task.due_date) < new Date() && (
                        <span className="badge bg-danger">Просрочено</span>
                      )}
                    </div>
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