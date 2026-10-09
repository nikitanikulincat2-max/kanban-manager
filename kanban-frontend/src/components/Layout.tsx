import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);

  // Закрытие dropdown по клику вне
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

  // Закрытие меню при смене страницы
  useEffect(() => {
    setDropdownOpen(false);
    setDrawerOpen(false);
  }, [location.pathname]);

  // Блокируем скролл body, когда меню открыто
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const handleLogout = () => {
    setDropdownOpen(false);
    setDrawerOpen(false);
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

          {/* Правая часть */}
          <div className="d-flex align-items-center gap-2 ms-auto">
            {/* ПК-навигация */}
            <ul className="navbar-nav flex-row gap-2 mb-0 kb-desktop-nav">
              <li className="nav-item">
                <Link to="/workspaces" className={isActive('/workspaces')}>
                  Пространства
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/dashboard" className={isActive('/dashboard')}>
                  Дашборд
                </Link>
              </li>
            </ul>

            {/* ПК-профиль */}
            <ul className="navbar-nav mb-0 kb-desktop-nav">
              <li className="nav-item position-relative" ref={dropdownRef}>
                <button
                  type="button"
                  className="btn btn-link nav-link dropdown-toggle text-decoration-none d-flex align-items-center gap-2"
                  style={{ color: 'white' }}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
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
                      minWidth: 180,
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

            {/* Мобильная кнопка-гамбургер */}
            <button
              className="kb-mobile-menu-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Открыть меню"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Мобильное меню-шторка */}
      {drawerOpen && (
        <>
          <div
            className="kb-mobile-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="kb-mobile-drawer">
            <div className="kb-mobile-drawer-header">
              <span className="kb-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
                {user?.username?.[0]?.toUpperCase() || '?'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                  {user?.username}
                </div>
                <div style={{ opacity: 0.8, fontSize: '0.85rem' }}>
                  вошёл в KanBan
                </div>
              </div>
            </div>

            <div className="kb-mobile-drawer-body">
              <Link to="/workspaces" className="kb-mobile-drawer-item">
                📋 <span>Пространства</span>
              </Link>
              <Link to="/dashboard" className="kb-mobile-drawer-item">
                📊 <span>Дашборд</span>
              </Link>
              <Link to="/profile" className="kb-mobile-drawer-item">
                👤 <span>Профиль</span>
              </Link>
              <hr style={{ margin: '8px 20px', borderColor: 'var(--kb-border)' }} />
              <button
                className="kb-mobile-drawer-item danger"
                onClick={handleLogout}
              >
                🚪 <span>Выйти</span>
              </button>
            </div>
          </aside>
        </>
      )}

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