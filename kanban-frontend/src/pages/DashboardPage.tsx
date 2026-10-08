import { useEffect, useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../api/axiosConfig';
import type { Paginated } from '../types';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface TaskItem {
  id: number;
  column: number;
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  title: string;
}

interface ColumnItem {
  id: number;
  name: string;
  board: number;
}

interface BoardItem {
  id: number;
  name: string;
}

function DashboardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [columns, setColumns] = useState<ColumnItem[]>([]);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Paginated<TaskItem> | TaskItem[]>('tasks/'),
      api.get<Paginated<ColumnItem> | ColumnItem[]>('columns/'),
      api.get<Paginated<BoardItem> | BoardItem[]>('boards/'),
    ])
      .then(([tRes, cRes, bRes]) => {
        const tList = Array.isArray(tRes.data) ? tRes.data : tRes.data.results;
        const cList = Array.isArray(cRes.data) ? cRes.data : cRes.data.results;
        const bList = Array.isArray(bRes.data) ? bRes.data : bRes.data.results;
        setTasks(tList);
        setColumns(cList);
        setBoards(bList);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Фильтруем колонки и задачи по выбранной доске
  const filteredColumns =
    selectedBoard === 'all'
      ? columns
      : columns.filter((c) => c.board === selectedBoard);

  const columnIds = new Set(filteredColumns.map((c) => c.id));
  const filteredTasks = tasks.filter((t) => columnIds.has(t.column));

  const total = filteredTasks.length;
  const overdue = filteredTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date()
  ).length;
  const highPriority = filteredTasks.filter((t) => t.priority === 'high').length;

  // Группируем задачи по названию колонки (не по ID), чтобы избежать дублей
  const tasksByColumnName = new Map<string, number>();
  filteredColumns.forEach((col) => {
    const count = filteredTasks.filter((t) => t.column === col.id).length;
    const existing = tasksByColumnName.get(col.name) || 0;
    tasksByColumnName.set(col.name, existing + count);
  });

  const columnLabels = Array.from(tasksByColumnName.keys());
  const columnCounts = Array.from(tasksByColumnName.values());

  const doughnutData = {
    labels: columnLabels,
    datasets: [
      {
        data: columnCounts,
        backgroundColor: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const barData = {
    labels: ['Высокий', 'Средний', 'Низкий'],
    datasets: [
      {
        label: 'Задач',
        data: [
          filteredTasks.filter((t) => t.priority === 'high').length,
          filteredTasks.filter((t) => t.priority === 'medium').length,
          filteredTasks.filter((t) => t.priority === 'low').length,
        ],
        backgroundColor: ['#ef4444', '#f59e0b', '#6b7280'],
        borderRadius: 8,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 16,
          font: { family: 'Inter', size: 13 },
          usePointStyle: true,
        },
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { family: 'Inter' } },
      },
      x: {
        ticks: { font: { family: 'Inter' } },
      },
    },
  };

  if (loading) {
    return (
      <div className="kb-loading">
        <span>Загрузка дашборда...</span>
      </div>
    );
  }

  return (
    <div className="kb-fade-in">
      {/* ═══ Заголовок страницы ═══ */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0" style={{ fontWeight: 700, fontSize: '2rem' }}>
          Дашборд
        </h1>

        <div className="d-flex align-items-center gap-2">
          <label className="form-label mb-0 text-muted small">Доска:</label>
          <select
            className="form-select"
            style={{ maxWidth: 260 }}
            value={selectedBoard}
            onChange={(e) =>
              setSelectedBoard(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
          >
            <option value="all">Все доски</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ═══ Метрики ═══ */}
      <div className="row mb-4">
        <div className="col-md-4 mb-3">
          <div className="kb-card text-center kb-slide-up h-100">
            <div className="card-body py-4">
              <h6
                className="text-muted mb-2 small text-uppercase"
                style={{ letterSpacing: '0.05em', fontWeight: 600 }}
              >
                Всего задач
              </h6>
              <h1
                className="mb-0"
                style={{
                  color: 'var(--kb-primary)',
                  fontWeight: 700,
                  fontSize: '2.5rem',
                }}
              >
                {total}
              </h1>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="kb-card text-center kb-slide-up kb-delay-1 h-100">
            <div className="card-body py-4">
              <h6
                className="text-muted mb-2 small text-uppercase"
                style={{ letterSpacing: '0.05em', fontWeight: 600 }}
              >
                Просрочено
              </h6>
              <h1
                className="mb-0"
                style={{
                  color: 'var(--kb-danger)',
                  fontWeight: 700,
                  fontSize: '2.5rem',
                }}
              >
                {overdue}
              </h1>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="kb-card text-center kb-slide-up kb-delay-2 h-100">
            <div className="card-body py-4">
              <h6
                className="text-muted mb-2 small text-uppercase"
                style={{ letterSpacing: '0.05em', fontWeight: 600 }}
              >
                Высокий приоритет
              </h6>
              <h1
                className="mb-0"
                style={{
                  color: 'var(--kb-warning)',
                  fontWeight: 700,
                  fontSize: '2.5rem',
                }}
              >
                {highPriority}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Диаграммы ═══ */}
      <div className="row">
        {/* Диаграмма по колонкам */}
        <div className="col-lg-6 mb-4">
          <div className="kb-card kb-slide-up kb-delay-3 h-100">
            <div className="card-body">
              <h5
                style={{
                  fontWeight: 600,
                  paddingBottom: 12,
                  marginBottom: 20,
                  borderBottom: '1px solid var(--kb-border)',
                  textAlign: 'center',
                }}
              >
                Задачи по колонкам
              </h5>
              {total === 0 ? (
                <p className="text-muted text-center py-5 mb-0">Нет задач</p>
              ) : (
                <div style={{ maxWidth: 400, margin: '0 auto' }}>
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Диаграмма по приоритету */}
        <div className="col-lg-6 mb-4">
          <div className="kb-card kb-slide-up kb-delay-4 h-100">
            <div className="card-body">
              <h5
                style={{
                  fontWeight: 600,
                  paddingBottom: 12,
                  marginBottom: 20,
                  borderBottom: '1px solid var(--kb-border)',
                  textAlign: 'center',
                }}
              >
                Задачи по приоритету
              </h5>
              {total === 0 ? (
                <p className="text-muted text-center py-5 mb-0">Нет задач</p>
              ) : (
                <div style={{ maxWidth: 500, margin: '0 auto' }}>
                  <Bar data={barData} options={barOptions} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;