from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import WorkspaceMembership


def get_workspace_from_obj(obj):
    """Извлекает workspace из любой модели — Board, Column, Task, Label, Comment."""
    if hasattr(obj, 'memberships'):          # сам Workspace
        return obj
    if hasattr(obj, 'workspace'):            # Board, Label
        return obj.workspace
    if hasattr(obj, 'board'):                # Column
        return obj.board.workspace
    if hasattr(obj, 'column'):               # Task
        return obj.column.board.workspace
    if hasattr(obj, 'task'):                 # Comment, TaskHistory
        return obj.task.column.board.workspace
    return None


class IsSystemAdmin(BasePermission):
    """Только Django superuser."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


class IsWorkspaceMember(BasePermission):
    """Участник пространства (member или manager). Суперюзер — всегда."""
    def has_object_permission(self, request, view, obj):
        # Суперюзер проходит всегда
        if request.user and request.user.is_superuser:
            return True

        workspace = get_workspace_from_obj(obj)
        if workspace is None:
            return False
        return workspace.memberships.filter(user=request.user).exists()


class IsWorkspaceManager(BasePermission):
    """Менеджер пространства. Суперюзер — всегда."""
    def has_object_permission(self, request, view, obj):
        # Суперюзер проходит всегда
        if request.user and request.user.is_superuser:
            return True

        workspace = get_workspace_from_obj(obj)
        if workspace is None:
            return False
        return workspace.memberships.filter(
            user=request.user, role='manager'
        ).exists()


class IsWorkspaceManagerOrReadOnly(BasePermission):
    """Читать — участникам, изменять — менеджерам. Суперюзер — всегда."""
    def has_object_permission(self, request, view, obj):
        # Суперюзер проходит всегда — и на чтение, и на запись
        if request.user and request.user.is_superuser:
            return True

        workspace = get_workspace_from_obj(obj)
        if workspace is None:
            return False

        is_member = workspace.memberships.filter(user=request.user).exists()
        if not is_member:
            return False

        if request.method in SAFE_METHODS:   # GET, HEAD, OPTIONS
            return True

        return workspace.memberships.filter(
            user=request.user, role='manager'
        ).exists()