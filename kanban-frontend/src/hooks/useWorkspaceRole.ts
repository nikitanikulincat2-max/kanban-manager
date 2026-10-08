import { useEffect, useState } from 'react';
import api from '../api/axiosConfig';
import { useAuth } from '../contexts/AuthContext';

interface Membership {
  id: number;
  user: { id: number; username: string };
  role: 'manager' | 'member';
}

interface WorkspaceResponse {
  id: number;
  name: string;
  memberships: Membership[];
}

interface CurrentUser {
  id: number;
  username: string;
  is_superuser: boolean;
}

export function useWorkspaceRole(workspaceId: number | null) {
  const { user } = useAuth();
  const [role, setRole] = useState<'manager' | 'member' | null>(null);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsSuperuser(false);
      return;
    }
    api
      .get<CurrentUser>('users/me/')
      .then((res) => setIsSuperuser(res.data.is_superuser || false))
      .catch(() => setIsSuperuser(false));
  }, [user]);

  useEffect(() => {
    if (!workspaceId || !user) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<WorkspaceResponse>(`workspaces/${workspaceId}/`)
      .then((res) => {
        const memberships = res.data.memberships || [];
        // Сравниваем по ID — id у реального user теперь настоящий
        const myMembership = memberships.find(
          (m) => m.user.id === user.id
        );
        setRole(myMembership?.role || null);
      })
      .catch((err) => {
        console.error('useWorkspaceRole error:', err);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, [workspaceId, user]);

  const effectiveIsManager = isSuperuser || role === 'manager';

  return {
    role,
    isManager: effectiveIsManager,
    isMember: role !== null || isSuperuser,
    isSuperuser,
    loading,
  };
}