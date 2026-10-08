import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);

  // Закрываем меню при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Закрываем меню при смене страницы
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    location.pathname.startsWith(path)
      ? 'nav-link kb-nav-link active'
      : 'nav-link kb-nav-link';

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg kb-navbar">
        <div className="container">
          {/* Логотип */}
          <Link to="/workspaces" className="kb-logo">
            <span className="kb-logo-icon">
              <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
                <rect x="12" y="16" width="11" height="32" rx="3" fill="white" />
                <rect x="26.5" y="16" width="11" height="22" rx="3" fill="white" />
                <rect x="41" y="16" width="11" height="14" rx="3" fill="white" />
              </svg>
            </span>
            <span>KanBan</span>
          </Link>

          <div className="d-flex align-items-center gap-3 ms-auto">
            {/* Основные ссылки */}
            <ul className="navbar-nav flex-row gap-2 mb-0">
              <li className="nav-item">
                <Link to="/workspaces" className={isActive('/workspaces')}>
                  Пространства
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/tasks" className={isActive('/tasks')}>
                  Задачи
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/dashboard" className={isActive('/dashboard')}>
                  Дашборд
                </Link>
              </li>
            </ul>

            {/* Dropdown пользователя */}
            <ul className="navbar-nav mb-0">
              <li className="nav-item position-relative" ref={dropdownRef}>
                <button
                  type="button"
                  className="btn btn-link nav-link dropdown-toggle text-decoration-none d-flex align-items-center gap-2"
                  style={{ color: 'white' }}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-expanded={dropdownOpen}
                >
                  <span className="kb-avatar">
                    {user?.username?.[0]?.toUpperCase() || '?'}
                  </span>
                  <span className="text-white">{user?.username}</span>
                </button>

                {dropdownOpen && (
                  <ul
                    className="dropdown-menu dropdown-menu-end show"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: 6,
                      minWidth: 200,
                      zIndex: 1050,
                      boxShadow: 'var(--kb-shadow-lg)',
                      border: 'none',
                      borderRadius: 'var(--kb-radius)',
                      animation: 'kb-fadeIn 0.15s ease-out',
                    }}
                  >
                    <li>
                      <Link to="/profile" className="dropdown-item">
                        👤 Профиль
                      </Link>
                    </li>
                    {user?.is_superuser && (
                      <>
                        <li>
                          <hr className="dropdown-divider" />
                        </li>
                        <li>
                          <a
                            href="http://localhost:8000/admin/"
                            target="_blank"
                            rel="noreferrer"
                            className="dropdown-item"
                          >
                            ⚙️ Django Admin
                          </a>
                        </li>
                      </>
                    )}
                    <li>
                      <hr className="dropdown-divider" />
                    </li>
                    <li>
                      <button
                        className="dropdown-item text-danger"
                        onClick={handleLogout}
                      >
                        🚪 Выйти
                      </button>
                    </li>
                  </ul>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <main className="container my-4 flex-grow-1 page-enter">
        <Outlet />
      </main>

      <footer className="kb-footer py-3 mt-auto">
        <div className="container text-center small">
          <strong style={{ color: 'var(--kb-primary)' }}>KanBan</strong> © 2026
          — менеджер задач для команд
        </div>
      </footer>
    </div>
  );
}

export default Layout;