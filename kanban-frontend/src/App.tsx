import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import WorkspaceListPage from './pages/WorkspaceListPage';
import WorkspaceDetailPage from './pages/WorkspaceDetailPage';
import BoardDetailPage from './pages/BoardDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import AllTasksPage from './pages/AllTasksPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="kb-loading">
        <span>Загрузка...</span>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="kb-route-wrapper">
      <Routes location={location}>
        {/* ─── Публичные маршруты ─────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* ─── Приватные маршруты ────────────────── */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/workspaces" />} />

          <Route
            path="workspaces"
            element={
              <PrivateRoute>
                <WorkspaceListPage />
              </PrivateRoute>
            }
          />

          <Route
            path="workspaces/:id"
            element={
              <PrivateRoute>
                <WorkspaceDetailPage />
              </PrivateRoute>
            }
          />

          <Route
            path="boards/:id"
            element={
              <PrivateRoute>
                <BoardDetailPage />
              </PrivateRoute>
            }
          />

          <Route
            path="tasks"
            element={
              <PrivateRoute>
                <AllTasksPage />
              </PrivateRoute>
            }
          />

          <Route
            path="tasks"
            element={
              <PrivateRoute>
                <AllTasksPage />
              </PrivateRoute>
            }
          />

          <Route
            path="tasks/:id"
            element={
              <PrivateRoute>
                <TaskDetailPage />
              </PrivateRoute>
            }
          />

          <Route
            path="dashboard"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />

          <Route
            path="profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />

          {/* ─── 404 для приватных путей ─────────── */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* ─── 404 для публичных путей ────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;