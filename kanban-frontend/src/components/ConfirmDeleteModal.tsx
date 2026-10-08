import { useEffect, useState } from 'react';

interface ConfirmDeleteModalProps {
  show: boolean;
  title: string;
  message: string;
  itemName: string;        // что вводить для подтверждения (например, название доски)
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmDeleteModal({
  show,
  title,
  message,
  itemName,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDeleteModalProps) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setTyped('');
      setError('');
    }
  }, [show]);

  if (!show) return null;

  const handleConfirm = () => {
    if (typed !== itemName) {
      setError('Название не совпадает');
      return;
    }
    onConfirm();
  };

  return (
    <div className="kb-modal-backdrop" onClick={loading ? undefined : onCancel}>
      <div
        className="kb-modal-content"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kb-modal-header">
          <div className="d-flex align-items-center" style={{ gap: 12 }}>
            <span
              className="d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </span>
            <h5 className="kb-modal-title">{title}</h5>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onCancel}
            disabled={loading}
          ></button>
        </div>

        <div className="kb-modal-body">
          <p
            className="mb-3"
            style={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}
          >
            {message}
          </p>

          <div
            className="p-3 mb-3"
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--kb-radius-sm)',
              fontSize: '0.9rem',
            }}
          >
            <strong style={{ color: '#ef4444' }}>Внимание:</strong> это
            действие нельзя отменить.
          </div>

          <label className="form-label" style={{ fontSize: '0.9rem' }}>
            Для подтверждения введите{' '}
            <strong style={{ color: 'var(--kb-primary)' }}>
              «{itemName}»
            </strong>
            :
          </label>
          <input
            type="text"
            className="form-control form-control-lg"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setError('');
            }}
            placeholder={itemName}
            autoFocus
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape' && !loading) onCancel();
            }}
          />

          {error && (
            <div className="alert alert-danger mt-2 mb-0 py-1 kb-shake">
              {error}
            </div>
          )}
        </div>

        <div className="kb-modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Отмена
          </button>
          <button
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={typed !== itemName || loading}
            style={{
              background: typed === itemName ? '#ef4444' : undefined,
              borderColor: typed === itemName ? '#ef4444' : undefined,
            }}
          >
            {loading ? 'Удаление...' : '🗑 Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;