from rest_framework.permissions import BasePermission, SAFE_METHODS

def get_workspace_from_obj(obj):
    if hasattr(obj, 'memberships'):
        return obj
    if hasattr(obj, 'workspace'):
        return obj.workspace
    if hasattr(obj, 'board'):
        return obj.board.workspace
    if hasattr(obj, 'column'):
        return obj.column.board.workspace
    if hasattr(obj, 'task'):
        return obj.task.column.board.workspace
    return None


class IsSystemAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


class IsWorkspaceMember(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_superuser:
            return True

        workspace = get_workspace_from_obj(obj)
        if workspace is None:
            return False
        return workspace.memberships.filter(user=request.user).exists()


class IsWorkspaceManager(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_superuser:
            return True

        workspace = get_workspace_from_obj(obj)
        if workspace is None:
            return False
        return workspace.memberships.filter(
            user=request.user, role='manager'
        ).exists()


class IsWorkspaceManagerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_superuser:
            return True

        workspace = get_workspace_from_obj(obj)
        if workspace is None:
            return False

        is_member = workspace.memberships.filter(user=request.user).exists()
        if not is_member:
            return False

        if request.method in SAFE_METHODS:
            return True

        return workspace.memberships.filter(
            user=request.user, role='manager'
        ).exists()