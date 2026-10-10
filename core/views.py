from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.exceptions import PermissionDenied
from django.contrib.auth import authenticate
from django.contrib.auth.models import User, Group
from django.db import transaction
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework_simplejwt.tokens import RefreshToken
from django_ratelimit.decorators import ratelimit
from .models import *
from .serializers import *
from .permissions import *
from .serializers import *
from .permissions import (
    IsSystemAdmin,
    IsWorkspaceMember,
    IsWorkspaceManager,
    IsWorkspaceManagerOrReadOnly,
)

def sync_manager_group(user):
    group, _ = Group.objects.get_or_create(name='Managers')
    if user.is_superuser:
        if not user.groups.filter(name='Managers').exists():
            user.groups.add(group)
        return

    has_manager_role = WorkspaceMembership.objects.filter(
        user=user, role='manager'
    ).exists()

    is_in_group = user.groups.filter(name='Managers').exists()

    if has_manager_role and not is_in_group:
        user.groups.add(group)
    elif not has_manager_role and is_in_group:
        user.groups.remove(group)

class AttachmentViewSet(viewsets.ModelViewSet):
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
        attachment = serializer.save(uploaded_by=self.request.user)
        file_name = attachment.file.name.split('/')[-1]
        TaskHistory.objects.create(
            task=attachment.task,
            user=self.request.user,
            field_name='Файл',
            old_value=None,
            new_value=f'загружен: «{file_name}»',
        )

    def perform_destroy(self, instance):
        if self.request.user.is_superuser:
            task = instance.task
            file_name = instance.file.name.split('/')[-1]
            instance.delete()
            TaskHistory.objects.create(
                task=task, user=self.request.user,
                field_name='Файл',
                old_value=f'удалён: «{file_name}»',
                new_value=None,
            )
            return

        workspace = instance.task.column.board.workspace
        is_manager = workspace.memberships.filter(
            user=self.request.user, role='manager'
        ).exists()

        if instance.uploaded_by != self.request.user and not is_manager:
            raise PermissionDenied('Нет прав на удаление файла')

        task = instance.task
        file_name = instance.file.name.split('/')[-1]
        instance.delete()

        TaskHistory.objects.create(
            task=task, user=self.request.user,
            field_name='Файл',
            old_value=f'удалён: «{file_name}»',
            new_value=None,
        )

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'detail': 'Пользователь успешно создан'}, status=201)
        return Response(serializer.errors, status=400)

class UserViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Список всех пользователей — только для суперпользователя."""
        if not request.user.is_superuser:
            return Response(
                {'detail': 'Только администратор может видеть всех пользователей'},
                status=403,
            )
        users = User.objects.all().order_by('username')
        return Response(UserSerializer(users, many=True).data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Поиск пользователей по логину/email — для приглашения в пространство."""
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
        is_manager = (
                self.request.user.is_superuser
                or self.request.user.groups.filter(name='Managers').exists()
        )
        if not is_manager:
            raise PermissionDenied(
                'Создавать пространства может только пользователь с ролью «Менеджер».'
            )

        workspace = serializer.save(created_by=self.request.user)

        with transaction.atomic():
            WorkspaceMembership.objects.create(
                user=self.request.user,
                workspace=workspace,
                role='manager',
            )
            sync_manager_group(self.request.user)

    def perform_destroy(self, instance):
        """Удаление пространства — только менеджер или суперюзер."""
        if not self.request.user.is_superuser:
            is_manager = instance.memberships.filter(
                user=self.request.user, role='manager'
            ).exists()
            if not is_manager:
                raise PermissionDenied('Только менеджер пространства может его удалить')
        manager_users = list(
            User.objects.filter(
                memberships__workspace=instance,
                memberships__role='manager',
            ).distinct()
        )

        with transaction.atomic():
            instance.delete()
            for user in manager_users:
                sync_manager_group(user)

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        """Приглашение участника или смена роли — только для менеджеров."""
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
            return Response(
                {'detail': 'Недопустимая роль. Разрешено: member, manager'},
                status=400,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Пользователь не найден'}, status=404)

        with transaction.atomic():
            membership, created = WorkspaceMembership.objects.update_or_create(
                user=user,
                workspace=workspace,
                defaults={'role': role},
            )
            # Синхронизируем группу Managers
            sync_manager_group(user)

        return Response(
            {
                'detail': f'{user.username} {"добавлен как" if created else "обновлён на"} {role}',
                'user_id': user.id,
                'username': user.username,
                'role': membership.role,
                'created': created,
            },
            status=201 if created else 200,
        )

    @action(detail=True, methods=['delete'])
    def remove_member(self, request, pk=None):
        """Удаление участника из пространства."""
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
            return Response(
                {'detail': 'Нельзя удалить создателя пространства'},
                status=400,
            )

        removed_user = membership.user

        with transaction.atomic():
            membership.delete()
            sync_manager_group(removed_user)

        return Response(status=204)

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

        def perform_destroy(self, instance):
            if self.request.user.is_superuser:
                instance.delete()
                return

            is_manager = instance.workspace.memberships.filter(
                user=self.request.user, role='manager'
            ).exists()

            if not is_manager:
                raise PermissionDenied('Только менеджер может удалить доску')

            instance.delete()

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

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['column', 'assignee', 'priority', 'labels']
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'priority', 'created_at', 'order']

    def get_queryset(self):
        """Фильтруем задачи с учётом видимости."""
        user = self.request.user

        if user.is_superuser:
            base_qs = Task.objects.all()
        else:
            # Берём только задачи из пространств пользователя
            base_qs = Task.objects.filter(
                column__board__workspace__memberships__user=user
            )

        # Дополнительно фильтруем по видимости
        from django.db.models import Q
        visible_qs = base_qs.filter(
            Q(visibility='public') |
            Q(visibility='private', created_by=user) |
            Q(visibility='private', assignee=user) |
            Q(visibility='group', group__memberships__user=user)
        ).distinct()

        return visible_qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TaskDetailSerializer
        return TaskSerializer

    def perform_create(self, serializer):
        column_id = self.request.data.get('column')
        column = Column.objects.get(id=column_id)

        if not self.request.user.is_superuser:
            is_member = column.board.workspace.memberships.filter(
                user=self.request.user
            ).exists()
            if not is_member:
                raise PermissionDenied('Нет доступа к пространству')

        task = serializer.save(created_by=self.request.user, column=column)
        TaskHistory.objects.create(
            task=task, user=self.request.user,
            field_name='status', old_value=None, new_value='created',
        )

    def perform_update(self, serializer):
        """Обновлять задачу может только автор, исполнитель, менеджер или суперюзер."""
        task = self.get_object()
        user = self.request.user

        # Проверка прав на редактирование
        if not user.is_superuser:
            workspace = task.column.board.workspace
            is_manager = workspace.memberships.filter(
                user=user, role='manager'
            ).exists()
            is_author = task.created_by == user
            is_assignee = task.assignee == user

            if not (is_manager or is_author or is_assignee):
                raise PermissionDenied(
                    'Редактировать задачу может только её автор, исполнитель или менеджер пространства'
                )

        old_data = {
            'column': task.column_id,
            'assignee': task.assignee_id,
            'priority': task.priority,
            'due_date': task.due_date,
        }
        updated = serializer.save()

        # Логирование
        if old_data['column'] != updated.column_id:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='column',
                old_value=str(old_data['column']),
                new_value=str(updated.column_id),
            )
        if old_data['assignee'] != updated.assignee_id:
            TaskHistory.objects.create(
                task=updated, user=user,
                field_name='assignee',
                old_value=str(old_data['assignee']),
                new_value=str(updated.assignee_id),
            )

    def perform_destroy(self, instance):
        user = self.request.user

        if user.is_superuser:
            instance.delete()
            return

        workspace = instance.column.board.workspace
        is_manager = workspace.memberships.filter(
            user=user, role='manager'
        ).exists()
        is_author = instance.created_by == user

        if not (is_manager or is_author):
            raise PermissionDenied(
                'Удалять задачу может только её автор или менеджер пространства'
            )
        instance.delete()

    @action(detail=True, methods=['post'])
    def move(self, request, pk=None):
        task = self.get_object()
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
            task=task, user=request.user,
            field_name='column',
            old_value=str(old_column.id),
            new_value=str(new_column.id),
        )
        return Response(TaskDetailSerializer(task).data)

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
        comment = serializer.save(author=self.request.user)
        preview = comment.text[:80] + '…' if len(comment.text) > 80 else comment.text
        TaskHistory.objects.create(
            task=comment.task,
            user=self.request.user,
            field_name='Комментарий',
            old_value=None,
            new_value=f'добавлен: «{preview}»',
        )

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

        preview = instance.text[:80] + '…' if len(instance.text) > 80 else instance.text
        TaskHistory.objects.create(
            task=instance.task,
            user=self.request.user,
            field_name='Комментарий',
            old_value=f'удалён: «{preview}»',
            new_value=None,
        )
        instance.delete()

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

@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
def rate_limited_login(request):
    """
    Вход в систему с ограничением попыток.

    Лимит: 5 попыток в минуту с одного IP.
    При превышении — 429 Too Many Requests.
    """
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'detail': 'Укажите логин и пароль'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(username=username, password=password)
    if user is None:
        return Response(
            {'detail': 'Неверный логин или пароль'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {'detail': 'Аккаунт заблокирован'},
            status=status.HTTP_403_FORBIDDEN,
        )

    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })

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
        """Добавить участника в группу."""
        group = self.get_object()

        is_manager = group.workspace.memberships.filter(
            user=request.user, role='manager'
        ).exists()
        if not (request.user.is_superuser or is_manager or group.created_by == request.user):
            return Response(
                {'detail': 'Нет прав добавлять участников'},
                status=403,
            )

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
        if not (request.user.is_superuser or is_manager or group.created_by == request.user):
            return Response({'detail': 'Нет прав'}, status=403)

        user_id = request.query_params.get('user_id')
        TaskGroupMembership.objects.filter(group=group, user_id=user_id).delete()
        return Response(status=204)