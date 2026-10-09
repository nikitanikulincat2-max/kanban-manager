import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import api from '../api/axiosConfig';
import type { Board, Column, Task, Paginated } from '../types';
import TaskModal from '../components/TaskModal';
import { useWorkspaceRole } from '../hooks/useWorkspaceRole';
import { useConfirm } from '../contexts/ConfirmContext';

function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Record<number, Task[]>>({});
  const [loading, setLoading] = useState(true);

  const { isManager } = useWorkspaceRole(board?.workspace || null);

  // Фильтры
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortBy, setSortBy] = useState('order');

  // Мобильное сворачивание фильтров
  const [showFilters, setShowFilters] = useState(false);

  const [allUsers, setAllUsers] = useState<{ id: number; username: string }[]>([]);

  // Модалки
  const [showModal, setShowModal] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<number | null>(null);

  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  useEffect(() => {
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, search, priorityFilter, assigneeFilter, sortBy]);

  const loadBoard = async () => {
    try {
      setLoading(true);
      const boardRes = await api.get<Board>(`boards/${id}/`);
      setBoard(boardRes.data);

      const columnsRes = await api.get<Paginated<Column> | Column[]>(
        `columns/?board=${id}`
      );
      const columnsList = Array.isArray(columnsRes.data)
        ? columnsRes.data
        : columnsRes.data.results;
      setColumns(columnsList);

      const tasksMap: Record<number, Task[]> = {};
      const usersSet = new Map<number, { id: number; username: string }>();

      for (const col of columnsList) {
        const params = new URLSearchParams();
        params.append('column', String(col.id));
        if (search) params.append('search', search);
        if (priorityFilter) params.append('priority', priorityFilter);
        if (assigneeFilter) params.append('assignee', assigneeFilter);
        if (sortBy) params.append('ordering', sortBy);

        const tasksRes = await api.get<Paginated<Task> | Task[]>(
          `tasks/?${params.toString()}`
        );
        const tasksList = Array.isArray(tasksRes.data)
          ? tasksRes.data
          : tasksRes.data.results;
        tasksMap[col.id] = tasksList;

        tasksList.forEach((t) => {
          if (t.assignee) {
            usersSet.set(t.assignee.id, {
              id: t.assignee.id,
              username: t.assignee.username,
            });
          }
        });
      }

      setTasks(tasksMap);
      setAllUsers(Array.from(usersSet.values()));
    } catch (err) {
      console.error('Ошибка загрузки доски:', err);
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceColId = parseInt(source.droppableId);
    const destColId = parseInt(destination.droppableId);

    const newTasks = { ...tasks };
    const sourceList = [...(newTasks[sourceColId] || [])];
    const destList = [...(newTasks[destColId] || [])];

    const [moved] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, { ...moved, column: destColId });

    newTasks[sourceColId] = sourceList;
    newTasks[destColId] = destList;
    setTasks(newTasks);

    try {
      await api.post(`tasks/${draggableId}/move/`, {
        column_id: destColId,
        order: destination.index,
      });
    } catch (err) {
      console.error('Не удалось переместить задачу:', err);
      loadBoard();
    }
  };

  // ─── Быстрое перемещение задачи ─────
  const moveTaskToColumn = async (taskId: number, toColumnId: number) => {
    try {
      await api.post(`tasks/${taskId}/move/`, {
        column_id: toColumnId,
        order: 0,
      });
      loadBoard();
    } catch (err: any) {
      console.error('Ошибка перемещения:', err);
      alert(err.response?.data?.detail || 'Не удалось переместить задачу');
    }
  };

  const deleteTask = async (taskId: number, title: string) => {
    const ok = await confirm({
      title: '🗑 Удаление задачи',
      message: `Удалить задачу «${title}»?\n\nЭто действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'danger',
    });

    if (!ok) return;

    try {
      await api.delete(`tasks/${taskId}/`);
      loadBoard();
    } catch (err: any) {
      console.error('Ошибка удаления:', err);
      alert(err.response?.data?.detail || 'Не удалось удалить задачу');
    }
  };

  const openCreateModal = (columnId: number) => {
    setSelectedColumnId(columnId);
    setShowModal(true);
  };

  const openTask = (taskId: number) => {
    navigate(`/tasks/${taskId}`);
  };

  const resetFilters = () => {
    setSearch('');
    setPriorityFilter('');
    setAssigneeFilter('');
    setSortBy('order');
  };

  const openCreateColumn = () => {
    setNewColumnName('');
    setShowColumnModal(true);
  };

  const createColumn = async () => {
    if (!newColumnName.trim()) return;
    try {
      await api.post('columns/', {
        board: Number(id),
        name: newColumnName,
        order: columns.length,
      });
      setShowColumnModal(false);
      setNewColumnName('');
      loadBoard();
    } catch (err: any) {
      console.error('Ошибка создания колонки:', err);
      alert(err.response?.data?.detail || 'Не удалось создать колонку');
    }
  };

  const hasActiveFilters =
    search !== '' ||
    priorityFilter !== '' ||
    assigneeFilter !== '' ||
    sortBy !== 'order';

  if (loading && !board) {
    return (
      <div className="kb-loading">
        <span>Загрузка доски...</span>
      </div>
    );
  }

  if (!board) {
    return <div className="alert alert-danger mt-5">Доска не найдена</div>;
  }

  return (
    <div>
      {/* Заголовок доски */}
      <div className="kb-board-header kb-fade-in">
        <div>
          <h2 className="mb-0">{board.name}</h2>
          {board.description && (
            <p className="text-muted mb-0">{board.description}</p>
          )}
        </div>
        <div className="d-flex gap-2">
          {isManager && (
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={openCreateColumn}
            >
              + Колонка
            </button>
          )}
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate(-1)}
          >
            ← Назад
          </button>
        </div>
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
          ></span>
        )}
        <span style={{ float: 'right' }}>{showFilters ? '▲' : '▼'}</span>
      </button>

      {/* Панель фильтров */}
      <div className={`kb-filters-panel ${showFilters ? 'is-open' : ''}`}>
        <div className="card mb-4 kb-slide-up">
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label small mb-1">Поиск</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Поиск по названию или описанию..."
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
                    <option key={u.id} value={u.id}>
                      {u.username}
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
                  <option value="order">По порядку</option>
                  <option value="due_date">По сроку</option>
                  <option value="-created_at">Сначала новые</option>
                  <option value="priority">По приоритету</option>
                </select>
              </div>

              <div className="col-md-2">
                <button
                  className="btn btn-outline-secondary w-100"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                >
                  Сбросить
                </button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-2 small text-muted kb-fade-in">
                Активны фильтры:
                {search && (
                  <span className="badge bg-info ms-1">поиск: {search}</span>
                )}
                {priorityFilter && (
                  <span className="badge bg-info ms-1">
                    приоритет: {priorityFilter}
                  </span>
                )}
                {assigneeFilter && (
                  <span className="badge bg-info ms-1">
                    исполнитель: {assigneeFilter}
                  </span>
                )}
                {sortBy !== 'order' && (
                  <span className="badge bg-info ms-1">
                    сортировка: {sortBy}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Мобильная подсказка */}
      <div className="kb-mobile-hint">
        👈 Проведите, чтобы увидеть все колонки 👉
      </div>

      {/* Канбан-доска */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kb-board-scroll">
          {columns.map((col, colIdx) => {
            const columnTasks = tasks[col.id] || [];
            const prevColumn = colIdx > 0 ? columns[colIdx - 1] : null;
            const nextColumn =
              colIdx < columns.length - 1 ? columns[colIdx + 1] : null;

            return (
              <div
                key={col.id}
                className="kb-board-column-wrapper kb-slide-up"
                style={{ animationDelay: `${colIdx * 0.1}s` }}
              >
                <div className="kb-column">
                  <div className="kb-column-header d-flex justify-content-between align-items-center">
                    <span className="fw-bold">{col.name}</span>
                    <div className="d-flex align-items-center gap-2">
                      <span className="kb-column-count">
                        {columnTasks.length}
                      </span>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => openCreateModal(col.id)}
                        title="Создать задачу"
                      >
                        + Задача
                      </button>
                    </div>
                  </div>

                  <Droppable droppableId={String(col.id)}>
                    {(provided, snapshot) => (
                      <div
                        className={`card-body kb-column-drop-zone ${
                          snapshot.isDraggingOver ? 'is-dragging-over' : ''
                        }`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {columnTasks.length === 0 &&
                          !snapshot.isDraggingOver && (
                            <p className="text-muted small text-center mb-0 py-4">
                              {hasActiveFilters
                                ? 'Ничего не найдено'
                                : 'Нет задач — перетащите сюда'}
                            </p>
                          )}

                        {columnTasks.map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={String(task.id)}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`kb-task-card kb-task-priority-${
                                  task.priority
                                } ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                style={provided.draggableProps.style}
                              >
                                <div className="d-flex justify-content-between align-items-start">
                                  <h6
                                    className="kb-task-title mb-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTask(task.id);
                                    }}
                                  >
                                    {task.title}
                                  </h6>
                                  <span
                                    className={`badge bg-${
                                      task.priority === 'high'
                                        ? 'danger'
                                        : task.priority === 'medium'
                                        ? 'warning'
                                        : 'secondary'
                                    }`}
                                    style={{ fontSize: '0.7em' }}
                                  >
                                    {task.priority}
                                  </span>
                                </div>

                                {task.description && (
                                  <p
                                    className="small text-muted mb-1"
                                    style={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                    }}
                                  >
                                    {task.description}
                                  </p>
                                )}

                                <div className="d-flex justify-content-between align-items-center small">
                                  <span className="text-muted">
                                    {task.assignee?.username ||
                                      'Без исполнителя'}
                                  </span>
                                  {task.due_date && (
                                    <span
                                      className={
                                        new Date(task.due_date) < new Date()
                                          ? 'text-danger'
                                          : 'text-muted'
                                      }
                                    >
                                      {task.due_date}
                                    </span>
                                  )}
                                </div>

                                {task.comments_count > 0 && (
                                  <div className="mt-1 small text-muted">
                                    💬 {task.comments_count}
                                  </div>
                                )}

                                {/* Быстрые действия */}
                                <div className="kb-task-actions">
                                  {prevColumn && (
                                    <button
                                      className="kb-task-action-btn kb-task-action-back"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveTaskToColumn(
                                          task.id,
                                          prevColumn.id
                                        );
                                      }}
                                      title={`Вернуть в «${prevColumn.name}»`}
                                    >
                                      ← {prevColumn.name}
                                    </button>
                                  )}

                                  {nextColumn && (
                                    <button
                                      className="kb-task-action-btn kb-task-action-forward"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveTaskToColumn(
                                          task.id,
                                          nextColumn.id
                                        );
                                      }}
                                      title={`Переместить в «${nextColumn.name}»`}
                                    >
                                      {nextColumn.name} →
                                    </button>
                                  )}

                                  <button
                                    className="kb-task-action-btn kb-task-action-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteTask(task.id, task.title);
                                    }}
                                    title="Удалить задачу"
                                  >
                                    🗑
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Модалка создания задачи */}
      {selectedColumnId !== null && board && (
        <TaskModal
          show={showModal}
          onHide={() => setShowModal(false)}
          columnId={selectedColumnId}
          workspaceId={board.workspace}
          onSuccess={() => {
            setShowModal(false);
            loadBoard();
          }}
        />
      )}

      {/* Модалка создания колонки */}
      {isManager && showColumnModal && (
        <div
          className="kb-modal-backdrop"
          onClick={() => setShowColumnModal(false)}
        >
          <div
            className="kb-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kb-modal-header">
              <h5 className="kb-modal-title">Новая колонка</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowColumnModal(false)}
              ></button>
            </div>
            <div className="kb-modal-body">
              <label className="form-label">Название колонки</label>
              <input
                type="text"
                className="form-control"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Например, Review"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createColumn();
                }}
              />
            </div>
            <div className="kb-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowColumnModal(false)}
              >
                Отмена
              </button>
              <button className="btn btn-primary" onClick={createColumn}>
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BoardDetailPage;