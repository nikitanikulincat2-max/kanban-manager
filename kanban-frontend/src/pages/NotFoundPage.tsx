import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: '60vh' }}
    >
      <div className="text-center kb-fade-in" style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 96, marginBottom: 16 }}>🧭</div>
        <h1
          style={{
            fontSize: '4rem',
            fontWeight: 700,
            color: 'var(--kb-primary)',
          }}
        >
          404
        </h1>
        <h4 className="mb-3">Страница не найдена</h4>
        <p className="text-muted mb-4">
          Возможно, она была удалена или вы ввели неверный адрес.
        </p>
        <Link to="/workspaces" className="btn btn-primary px-4">
          ← Вернуться на главную
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;