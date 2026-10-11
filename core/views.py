from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.exceptions import PermissionDenied
from django.contrib.auth.models import User
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    Workspace, WorkspaceMembership, Board, Column, Label,
    Task, Comment, TaskHistory, Attachment,
    TaskGroup, TaskGroupMembership,
)
from .serializers import (
    UserSerializer,
    WorkspaceSerializer,
    WorkspaceMembershipSerializer,
    BoardSerializer,
    ColumnSerializer,
    LabelSerializer,
    TaskSerializer,
    TaskDetailSerializer,
    CommentSerializer,
    TaskHistorySerializer,
    AttachmentSerializer,
    TaskGroupSerializer,
    TaskGroupMembershipSerializer,
    RegisterSerializer,
)
from .permissions import (
    IsSystemAdmin,
    IsWorkspaceMember,
    IsWorkspaceManager,
    IsWorkspaceManagerOrReadOnly,
)


# ─── AUTH / REGISTER ───────────────────────────────────
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'detail': 'Пользователь успешно создан'}, status=201)
        return Response(serializer.errors, status=400)


# ─── USERS ─────────────────────────────────────────────
class UserViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        if not request.user.is_superuser:
            return Response(
                {'detail': 'Только администратор может видеть всех пользователей'},
                status=403,
            )
        users = User.objects.all().order_by('username')
        return Response(UserSerializer(users, many=True).data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response([])
        users = User.objects.filter(
            Q(username__icontains=query) | Q(email__icontains=query)
        ).order_by('username')[:10]
        return Response(UserSerializer(users, many=True).data)

    @action(detail=False, methods=['get'])
    def me(self, request):
        return Response(UserSerializer(request.user).data)


# ─── WORKSPACES ────────────────────────────────────────
class WorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Workspace.objects.all().distinct()
        return Workspace.objects.filter(
            memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        workspace = serializer.save(created_by=self.request.user)
        WorkspaceMembership.objects.create(
            user=self.request.user,
            workspace=workspace,
            role='manager',
        )

    def perform_destroy(self, instance):
        if self.request.user.is_superuser:
            instance.delete()
            return
        is_manager = instance.memberships.filter(
            user=self.request.user, role='manager'
        ).exists()
        if not is_manager:
            raise PermissionDenied('Только менеджер может удалить пространство')
        instance.delete()

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        workspace = self.get_object()

        if not request.user.is_superuser:
            is_manager = workspace.memberships.filter(
                user=request.user, role='manager'
            ).exists()
            if not is_manager:
                return Response(
                    {'detail': 'Только менеджер может приглашать участников'},
                    status=403,
                )

        user_id = request.data.get('user_id')
        role = request.data.get('role', 'member')
        if role not in ['member', 'manager']:
            return Response({'detail': 'Недопустимая роль'}, status=400)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Пользователь не найден'}, status=404)

        membership, created = WorkspaceMembership.objects.update_or_create(
            user=user, workspace=workspace,
            defaults={'role': role},
        )

        return Response(
            {'detail': f'{user.username} добавлен как {role}'},
            status=201 if created else 200,
        )

    @action(detail=True, methods=['delete'])
    def remove_member(self, request, pk=None):
        workspace = self.get_object()

        if not request.user.is_superuser:
            is_manager = workspace.memberships.filter(
                user=request.user, role='manager'
            ).exists()
            if not is_manager:
                return Response({'detail': 'Недостаточно прав'}, status=403)

        user_id = request.query_params.get('user_id')
        try:
            membership = workspace.memberships.get(user_id=user_id)
        except WorkspaceMembership.DoesNotExist:
            return Response({'detail': 'Участник не найден'}, status=404)

        if membership.user == workspace.created_by:
            return Response({'detail': 'Нельзя удалить создателя'}, status=400)

        membership.delete()
        return Response(status=204)


# ─── BOARDS ────────────────────────────────────────────
class BoardViewSet(viewsets.ModelViewSet):
    serializer_class = BoardSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['workspace']

    def get_queryset(self):
        if self.request.user.is_superuser:
            queryset = Board.objects.all()
        else:
            queryset = Board.objects.filter(
                workspace__memberships__user=self.request.user
            )

        workspace_id = self.request.query_params.get('workspace')
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)

        return queryset.distinct()

    def perform_create(self, serializer):
        workspace_id = self.request.data.get('workspace')
        workspace = Workspace.objects.get(id=workspace_id)

        if not self.request.user.is_superuser:
            is_manager = workspace.memberships.filter(
                user=self.request.user, role='manager'
            ).exists()
            if not is_manager:
                raise PermissionDenied('Только менеджер может создавать доски')

        board = serializer.save(workspace=workspace)

        Column.objects.bulk_create([
            Column(board=board, name='К выполнению', order=0),
            Column(board=board, name='В работе', order=1),
            Column(board=board, name='Готово', order=2),
        ])


# ─── COLUMNS ───────────────────────────────────────────
class ColumnViewSet(viewsets.ModelViewSet):
    serializer_class = ColumnSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['board']

    def get_queryset(self):
        if self.request.user.is_superuser:
            queryset = Column.objects.all()
        else:
            queryset = Column.objects.filter(
                board__workspace__memberships__user=self.request.user
            )

        board_id = self.request.query_params.get('board')
        if board_id:
            queryset = queryset.filter(board_id=board_id)

        return queryset.distinct()

    def perform_create(self, serializer):
        board_id = self.request.data.get('board')
        board = Board.objects.get(id=board_id)

        if not self.request.user.is_superuser:
            is_manager = board.workspace.memberships.filter(
                user=self.request.user, role='manager'
            ).exists()
            if not is_manager:
                raise PermissionDenied('Только менеджер может создавать колонки')

        serializer.save(board=board)


# ─── TASKS ─────────────────────────────────────────────
class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['column', 'assignee', 'priority', 'labels']
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'priority', 'created_at', 'order']

    def get_queryset(self):
        user = self.request.user

        if user.is_superuser:
            base_qs = Task.objects.all()
        else:
            base_qs = Task.objects.filter(
                column__board__workspace__memberships__user=user
            )

        visible_qs = base_qs.filter(
            Q(visibility='public') |
            Q(visibility='private', created_by=user) |
            Q(visibility='private', assignee=user) |
            Q(visibility='users', visible_to_users=user) |
            Q(visibility='group', group__memberships__user=user) |
            Q(created_by=user)
        ).distinct()

        return visible_qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TaskDetailSerializer
        return TaskSerializer

    def _is_manager_of_task(self, task, user):
        if user.is_superuser:
            return True
        workspace = task.column.board.workspace
        return workspace.memberships.filter(
            user=user, role='manager'
        ).exists()

    def perform_create(self, serializer):
        column_id = self.request.data.get('column')
        column = Column.objects.get(id=column_id)

        if not self.request.user.is_superuser:
            is_member = column.board.workspace.memberships.filter(
                user=self.request.user
            ).exists()
            if not is_member:
                raise PermissionDenied('Нет доступа к пространству')

        serializer.save(created_by=self.request.user, column=column)

    def perform_update(self, serializer):
        task = self.get_object()
        user = self.request.user

        if not user.is_superuser:
            is_manager = self._is_manager_of_task(task, user)
            is_author = task.created_by == user
            is_assignee = task.assignee == user

            if not (is_manager or is_author or is_assignee):
                raise PermissionDenied(
                    'Редактировать задачу может только её автор, '
                    'исполнитель или менеджер пространства'
                )

        PRIORITY_LABELS = {'low': 'Низкий', 'medium': 'Средний', 'high': 'Высокий'}

        old_data = {
            'title': task.title,
            'description': task.description or '',
            'column_id': task.column_id,
            'column_name': task.column.name,
            'assignee_id': task.assignee_id,
            'assignee_username': task.assignee.username if task.assignee else None,
            'priority': task.priority,
            'due_date': str(task.due_date) if task.due_date else None,
            'visibility': task.visibility,
            'visibility_display': task.get_visibility_display(),
            'group_id': task.group_id,
            'group_name': task.group.name if task.group else None,
            'visible_users': set(task.visible_to_users.values_list('id', flat=True)),
        }

        updated = serializer.save()

        if old_data['column_id'] != updated.column_id:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Колонка',
                old_value=old_data['column_name'],
                new_value=updated.column.name,
            )

        new_assignee_name = updated.assignee.username if updated.assignee else 'Не назначен'
        old_assignee_name = old_data['assignee_username'] or 'Не назначен'
        if old_data['assignee_id'] != updated.assignee_id:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Исполнитель',
                old_value=old_assignee_name,
                new_value=new_assignee_name,
            )

        if old_data['priority'] != updated.priority:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Приоритет',
                old_value=PRIORITY_LABELS.get(old_data['priority'], old_data['priority']),
                new_value=PRIORITY_LABELS.get(updated.priority, updated.priority),
            )

        new_due = str(updated.due_date) if updated.due_date else None
        if old_data['due_date'] != new_due:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Срок',
                old_value=old_data['due_date'] or 'Не задан',
                new_value=new_due or 'Не задан',
            )

        if old_data['visibility'] != updated.visibility:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Видимость',
                old_value=old_data['visibility_display'],
                new_value=updated.get_visibility_display(),
            )

        new_group_name = updated.group.name if updated.group else None
        if old_data['group_id'] != updated.group_id:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Группа',
                old_value=old_data['group_name'] or 'Не задана',
                new_value=new_group_name or 'Не задана',
            )

        new_visible_users = set(updated.visible_to_users.values_list('id', flat=True))
        if old_data['visible_users'] != new_visible_users:
            def names(ids_set):
                if not ids_set:
                    return 'Не выбраны'
                names_list = list(
                    User.objects.filter(id__in=ids_set).values_list('username', flat=True)
                )
                shown = ', '.join(names_list[:3])
                suffix = f' и ещё {len(names_list) - 3}' if len(names_list) > 3 else ''
                return f'{len(names_list)} чел.: {shown}{suffix}'

            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Видимые пользователи',
                old_value=names(old_data['visible_users']),
                new_value=names(new_visible_users),
            )

        if old_data['title'] != updated.title:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Название',
                old_value=old_data['title'],
                new_value=updated.title,
            )

        if old_data['description'] != (updated.description or ''):
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='Описание',
                old_value='было',
                new_value='изменено',
            )

    def perform_destroy(self, instance):
        """Удалять задачу может только менеджер пространства."""
        user = self.request.user
        if not self._is_manager_of_task(instance, user):
            raise PermissionDenied(
                'Удалять задачи может только менеджер пространства'
            )
        instance.delete()

    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        """Перемещать задачу может только менеджер пространства."""
        task = self.get_object()
        user = request.user

        if not self._is_manager_of_task(task, user):
            return Response(
                {'detail': 'Перемещать задачи может только менеджер пространства'},
                status=403,
            )

        new_column_id = request.data.get('column_id')
        new_order = request.data.get('order', 0)

        try:
            new_column = Column.objects.get(id=new_column_id)
        except Column.DoesNotExist:
            return Response({'detail': 'Колонка не найдена'}, status=404)

        old_column = task.column
        task.column = new_column
        task.order = new_order
        task.save()

        TaskHistory.objects.create(
            task=task, user=user,
            field_name='Колонка',
            old_value=old_column.name,
            new_value=new_column.name,
        )
        return Response(TaskDetailSerializer(task).data)


# ─── COMMENTS ──────────────────────────────────────────
class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Comment.objects.all().distinct()
        return Comment.objects.filter(
            task__column__board__workspace__memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_destroy(self, instance):
        if self.request.user.is_superuser:
            instance.delete()
            return
        workspace = instance.task.column.board.workspace
        is_manager = workspace.memberships.filter(
            user=self.request.user, role='manager'
        ).exists()
        if instance.author != self.request.user and not is_manager:
            raise PermissionDenied('Нет прав на удаление комментария')
        instance.delete()


# ─── LABELS ────────────────────────────────────────────
class LabelViewSet(viewsets.ModelViewSet):
    serializer_class = LabelSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceManagerOrReadOnly]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Label.objects.all().distinct()
        return Label.objects.filter(
            workspace__memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        workspace_id = self.request.data.get('workspace')
        workspace = Workspace.objects.get(id=workspace_id)

        if not self.request.user.is_superuser:
            is_manager = workspace.memberships.filter(
                user=self.request.user, role='manager'
            ).exists()
            if not is_manager:
                raise PermissionDenied('Только менеджер может создавать метки')

        serializer.save(workspace=workspace)


# ─── TASK GROUPS ───────────────────────────────────────
class TaskGroupViewSet(viewsets.ModelViewSet):
    serializer_class = TaskGroupSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['workspace']

    def get_queryset(self):
        if self.request.user.is_superuser:
            return TaskGroup.objects.all()
        return TaskGroup.objects.filter(
            workspace__memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        workspace_id = self.request.data.get('workspace')
        workspace = Workspace.objects.get(id=workspace_id)

        if not self.request.user.is_superuser:
            is_manager = workspace.memberships.filter(
                user=self.request.user, role='manager'
            ).exists()
            if not is_manager:
                raise PermissionDenied(
                    'Только менеджер пространства может создавать группы'
                )

        group = serializer.save(created_by=self.request.user)
        TaskGroupMembership.objects.create(
            group=group, user=self.request.user
        )

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        group = self.get_object()
        is_manager = group.workspace.memberships.filter(
            user=request.user, role='manager'
        ).exists()
        if not (
            request.user.is_superuser
            or is_manager
            or group.created_by == request.user
        ):
            return Response({'detail': 'Нет прав'}, status=403)

        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Пользователь не найден'}, status=404)

        if not group.workspace.memberships.filter(user=user).exists():
            return Response(
                {'detail': 'Пользователь не состоит в пространстве'},
                status=400,
            )

        TaskGroupMembership.objects.get_or_create(group=group, user=user)
        return Response(TaskGroupSerializer(group).data)

    @action(detail=True, methods=['delete'])
    def remove_member(self, request, pk=None):
        group = self.get_object()
        is_manager = group.workspace.memberships.filter(
            user=request.user, role='manager'
        ).exists()
        if not (
            request.user.is_superuser
            or is_manager
            or group.created_by == request.user
        ):
            return Response({'detail': 'Нет прав'}, status=403)

        user_id = request.query_params.get('user_id')
        TaskGroupMembership.objects.filter(
            group=group, user_id=user_id
        ).delete()
        return Response(status=204)


# ─── ATTACHMENTS ───────────────────────────────────────
class AttachmentViewSet(viewsets.ModelViewSet):
    """Файлы, прикреплённые к задачам."""
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Attachment.objects.all()
        return Attachment.objects.filter(
            task__column__board__workspace__memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        task_id = self.request.data.get('task')
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            raise PermissionDenied('Задача не найдена')

        # Пользователь должен быть участником пространства задачи
        if not self.request.user.is_superuser:
            is_member = task.column.board.workspace.memberships.filter(
                user=self.request.user
            ).exists()
            if not is_member:
                raise PermissionDenied('Нет доступа к задаче')

        # Проверка файла
        file = self.request.FILES.get('file')
        if not file:
            raise PermissionDenied('Файл не передан')

        if file.size > 10 * 1024 * 1024:
            raise PermissionDenied('Файл не должен превышать 10 МБ')

        allowed_ext = [
            'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
            'zip', 'rar', '7z', 'doc', 'docx', 'xls', 'xlsx',
        ]
        ext = file.name.split('.').pop().lower()
        if ext not in allowed_ext:
            raise PermissionDenied(f'Формат .{ext} не поддерживается')

        serializer.save(task=task, uploaded_by=self.request.user)

    def perform_destroy(self, instance):
        user = self.request.user
        if not user.is_superuser:
            workspace = instance.task.column.board.workspace
            is_manager = workspace.memberships.filter(
                user=user, role='manager'
            ).exists()
            is_author = instance.uploaded_by == user
            if not (is_author or is_manager):
                raise PermissionDenied(
                    'Удалять файл может только его автор или менеджер пространства'
                )
        instance.delete()