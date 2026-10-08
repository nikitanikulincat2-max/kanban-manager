import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../api/axiosConfig';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('access_token')
  );
  const [loading, setLoading] = useState(true);

  // При загрузке приложения — если токен есть, подтягиваем пользователя с сервера
  useEffect(() => {
    const loadUser = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<User>('users/me/');
        setUser(res.data);
      } catch (err) {
        console.error('Не удалось загрузить пользователя', err);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
  try {
    const res = await api.post('token/', { username, password });
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    setToken(res.data.access);
    const meRes = await api.get<User>('users/me/');
    setUser(meRes.data);
    return true;
  } catch (err: any) {
    console.error('Login error:', err);
    throw err;
  }
};

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const register = async (
    username: string,
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      await api.post('register/', {
        username,
        email,
        password,
        password2: password,
      });
      return { ok: true };
    } catch (err: any) {
      const data = err.response?.data || {};
      const detail =
        data.username?.[0] ||
        data.password?.[0] ||
        data.email?.[0] ||
        data.non_field_errors?.[0] ||
        data.detail ||
        'Ошибка регистрации';
      return { ok: false, error: detail };
    }
  };

  // 🔄 Обновить данные текущего пользователя (роли, is_manager и т.д.)
  const refreshUser = async () => {
    try {
      const res = await api.get<User>('users/me/');
      setUser(res.data);
    } catch (err) {
      console.error('Не удалось обновить пользователя', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, register, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};