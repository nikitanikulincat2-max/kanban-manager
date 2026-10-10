import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axiosConfig';
import type { Workspace, Board, Paginated } from '../types';
import { useWorkspaceRole } from '../hooks/useWorkspaceRole';
import MembersModal from '../components/MembersModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workspaceId = id ? Number(id) : null;
  const { isManager } = useWorkspaceRole(workspaceId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteWsModal, setShowDeleteWsModal] = useState(false);

  useEffect(() => {
    loadWorkspace();
  }, [id]);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError('');
      const wsRes = await api.get<Workspace>(`workspaces/${id}/`);
      setWorkspace(wsRes.data);

      const boardsRes = await api.get<Paginated<Board> | Board[]>(
        `boards/?workspace=${id}`
      );
      const boardsList = Array.isArray(boardsRes.data)
        ? boardsRes.data
        : boardsRes.data.results;
      setBoards(boardsList);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Не удалось загрузить пространство';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async (e: FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    setError('');
    try {
      await api.post('boards/', { workspace: Number(id), name: boardName });
      setBoardName('');
      toast.success('Доска создана');
      loadWorkspace();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Ошибка создания доски';
      setError(msg);
      toast.error(msg);
    }
  };

  const deleteWorkspace = async () => {
  if (!workspace) return;
  setDeleting(true);
  try {
    await api.delete(`workspaces/${workspace.id}/`);
    toast.success('Пространство удалено');
    navigate('/workspaces');
  } catch (err: any) {
    toast.error(err.response?.data?.detail || 'Не удалось удалить пространство');
    setDeleting(false);
    setShowDeleteWsModal(false);
  }
};

  if (loading) return <div className="kb-loading"><span>Загрузка...</span></div>;
  if (!workspace) return <div className="alert alert-danger mt-5">Пространство не найдено</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">{workspace.name}</h2>
          <small className="text-muted">
            Ваша роль:{' '}
            <span className={`badge bg-${isManager ? 'danger' : 'secondary'}`}>
              {isManager ? 'Менеджер' : 'Участник'}
            </span>
          </small>
        </div>

        <div className="d-flex gap-2">
          {isManager && (
            <button
              className="btn btn-outline-info btn-sm"
              onClick={() => setShowMembers(true)}
            >
              👥 Участники
            </button>
          )}
          <Link
              to={`/workspaces/${workspace.id}/groups`}
              className="btn btn-outline-primary btn-sm"
            >
              👥 Группы
            </Link>
          {isManager && (
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => setShowDeleteWsModal(true)}
              disabled={deleting}
            >
              {deleting ? 'Удаление...' : '🗑 Удалить'}
            </button>
          )}
          <Link to="/workspaces" className="btn btn-outline-secondary btn-sm">
            ← К списку
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {isManager ? (
        <form onSubmit={createBoard} className="mb-4 d-flex gap-2">
          <input
            className="form-control"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            placeholder="Название новой доски"
            required
          />
          <button type="submit" className="btn btn-success">Создать доску</button>
        </form>
      ) : (
        <div className="alert alert-info">
          Вы — участник. Только менеджер пространства может создавать доски.
        </div>
      )}

      {boards.length === 0 ? (
        <p className="text-muted">Пока нет ни одной доски.</p>
      ) : (
        <div className="row">
          {boards.map((b) => (
            <div key={b.id} className="col-md-4 mb-3">
              <div className="kb-card kb-card-hover h-100">
                <div style={{ padding: '20px 24px' }}>
                  <h5 style={{ fontWeight: 600 }}>{b.name}</h5>
                  {b.description && (
                    <p className="text-muted small">{b.description}</p>
                  )}
                  <Link to={`/boards/${b.id}`} className="btn btn-primary btn-sm">
                    Открыть доску
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {workspace && (
        <ConfirmDeleteModal
          show={showDeleteWsModal}
          title="Удаление пространства"
          message={`Вы собираетесь удалить пространство «${workspace.name}».\n\nВсе доски, колонки, задачи и комментарии будут безвозвратно удалены.`}
          itemName={workspace.name}
          onConfirm={deleteWorkspace}
          onCancel={() => setShowDeleteWsModal(false)}
          loading={deleting}
        />
      )}

      {workspace && (
        <MembersModal
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          show={showMembers}
          onHide={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}

export default WorkspaceDetailPage;