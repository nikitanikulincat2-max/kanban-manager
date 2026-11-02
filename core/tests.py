from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import (
    Workspace, WorkspaceMembership, Board, Column, Task,
    TaskGroup, TaskGroupMembership, Comment,
)


class AuthTestCase(APITestCase):
    """Тесты регистрации и авторизации."""

    def test_01_register_new_user(self):
        """Успешная регистрация."""
        response = self.client.post('/api/register/', {
            'username': 'newuser',
            'email': 'new@example.com',
            'password': 'StrongPass123',
            'password2': 'StrongPass123',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_02_register_duplicate_username(self):
        """Повторная регистрация с занятым логином."""
        User.objects.create_user(username='existing', password='pass12345')
        response = self.client.post('/api/register/', {
            'username': 'existing',
            'email': 'x@example.com',
            'password': 'StrongPass123',
            'password2': 'StrongPass123',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_03_register_password_mismatch(self):
        """Пароли не совпадают."""
        response = self.client.post('/api/register/', {
            'username': 'user1',
            'email': 'x@example.com',
            'password': 'StrongPass123',
            'password2': 'DifferentPass456',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_04_token_obtain(self):
        """Получение JWT-токена."""
        User.objects.create_user(username='user1', password='StrongPass123')
        response = self.client.post('/api/token/', {
            'username': 'user1',
            'password': 'StrongPass123',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)


class TaskCRUDTestCase(APITestCase):
    """Тесты CRUD задач и прав доступа."""

    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin', password='AdminPass123')
        self.manager = User.objects.create_user(username='manager', password='Pass12345')
        self.member = User.objects.create_user(username='member', password='Pass12345')

        self.workspace = Workspace.objects.create(name='Test WS', created_by=self.manager)
        WorkspaceMembership.objects.create(user=self.manager, workspace=self.workspace, role='manager')
        WorkspaceMembership.objects.create(user=self.member, workspace=self.workspace, role='member')

        self.board = Board.objects.create(workspace=self.workspace, name='Board')
        self.col1 = Column.objects.create(board=self.board, name='К выполнению', order=0)
        self.col2 = Column.objects.create(board=self.board, name='В работе', order=1)

    def test_05_create_task_as_member(self):
        """Участник может создать задачу."""
        self.client.force_authenticate(user=self.member)
        response = self.client.post('/api/tasks/', {
            'column': self.col1.id,
            'title': 'Test Task',
            'description': 'Desc',
            'priority': 'medium',
            'visibility': 'public',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Task.objects.count(), 1)

    def test_06_member_cannot_delete_task(self):
        """Участник не может удалить задачу."""
        task = Task.objects.create(column=self.col1, title='T', created_by=self.manager)
        self.client.force_authenticate(user=self.member)
        response = self.client.delete(f'/api/tasks/{task.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_07_manager_can_delete_task(self):
        """Менеджер может удалить задачу."""
        task = Task.objects.create(column=self.col1, title='T', created_by=self.manager)
        self.client.force_authenticate(user=self.manager)
        response = self.client.delete(f'/api/tasks/{task.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_08_member_cannot_move_task(self):
        """Участник не может перемещать задачу."""
        task = Task.objects.create(column=self.col1, title='T', created_by=self.manager)
        self.client.force_authenticate(user=self.member)
        response = self.client.post(f'/api/tasks/{task.id}/move/', {
            'column_id': self.col2.id,
            'order': 0,
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_09_manager_can_move_task(self):
        """Менеджер перемещает задачу."""
        task = Task.objects.create(column=self.col1, title='T', created_by=self.manager)
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f'/api/tasks/{task.id}/move/', {
            'column_id': self.col2.id,
            'order': 0,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.column_id, self.col2.id)


class TaskVisibilityTestCase(APITestCase):
    """Тесты механизма видимости задач."""

    def setUp(self):
        self.author = User.objects.create_user(username='author', password='Pass12345')
        self.other = User.objects.create_user(username='other', password='Pass12345')
        self.selected = User.objects.create_user(username='selected', password='Pass12345')

        self.ws = Workspace.objects.create(name='WS', created_by=self.author)
        for u in [self.author, self.other, self.selected]:
            WorkspaceMembership.objects.create(user=u, workspace=self.ws, role='member')

        self.board = Board.objects.create(workspace=self.ws, name='B')
        self.col = Column.objects.create(board=self.board, name='Col')

    def test_10_public_visible_to_all(self):
        """Public-задача видна всем."""
        Task.objects.create(column=self.col, title='Public', created_by=self.author, visibility='public')
        self.client.force_authenticate(user=self.other)
        response = self.client.get('/api/tasks/')
        tasks = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(tasks), 1)

    def test_11_private_visible_only_author(self):
        """Private-задача видна только автору."""
        Task.objects.create(column=self.col, title='Private', created_by=self.author, visibility='private')
        self.client.force_authenticate(user=self.other)
        response = self.client.get('/api/tasks/')
        tasks = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(tasks), 0)

        self.client.force_authenticate(user=self.author)
        response = self.client.get('/api/tasks/')
        tasks = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(tasks), 1)

    def test_12_users_visibility(self):
        """Задача видна выбранному пользователю."""
        task = Task.objects.create(
            column=self.col, title='For Selected',
            created_by=self.author, visibility='users'
        )
        task.visible_to_users.add(self.selected)

        # Выбранный видит
        self.client.force_authenticate(user=self.selected)
        response = self.client.get('/api/tasks/')
        tasks = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(tasks), 1)

        # Не выбранный — не видит
        self.client.force_authenticate(user=self.other)
        response = self.client.get('/api/tasks/')
        tasks = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(tasks), 0)

    def test_13_group_visibility(self):
        """Задача видна участникам группы."""
        group = TaskGroup.objects.create(workspace=self.ws, name='Group', created_by=self.author)
        TaskGroupMembership.objects.create(group=group, user=self.selected)

        Task.objects.create(
            column=self.col, title='Group Task',
            created_by=self.author, visibility='group', group=group
        )

        # Участник группы видит
        self.client.force_authenticate(user=self.selected)
        response = self.client.get('/api/tasks/')
        tasks = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(tasks), 1)

        # Не участник — не видит
        self.client.force_authenticate(user=self.other)
        response = self.client.get('/api/tasks/')
        tasks = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(tasks), 0)


class CommentTestCase(APITestCase):
    """Тесты комментариев."""

    def setUp(self):
        self.user = User.objects.create_user(username='u', password='Pass12345')
        self.ws = Workspace.objects.create(name='WS', created_by=self.user)
        WorkspaceMembership.objects.create(user=self.user, workspace=self.ws, role='manager')
        self.board = Board.objects.create(workspace=self.ws, name='B')
        self.col = Column.objects.create(board=self.board, name='C')
        self.task = Task.objects.create(column=self.col, title='T', created_by=self.user)

    def test_14_add_comment(self):
        """Добавление комментария."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/comments/', {
            'task': self.task.id,
            'text': 'Test comment',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 1)

    def test_15_empty_comment_rejected(self):
        """Пустой комментарий отклоняется."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/comments/', {
            'task': self.task.id,
            'text': '',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AttachmentTestCase(APITestCase):
    """Тесты файлов."""

    def setUp(self):
        self.user = User.objects.create_user(username='u', password='Pass12345')
        self.ws = Workspace.objects.create(name='WS', created_by=self.user)
        WorkspaceMembership.objects.create(user=self.user, workspace=self.ws, role='manager')
        self.board = Board.objects.create(workspace=self.ws, name='B')
        self.col = Column.objects.create(board=self.board, name='C')
        self.task = Task.objects.create(column=self.col, title='T', created_by=self.user)

    def test_16_upload_pdf(self):
        """Загрузка PDF-файла."""
        self.client.force_authenticate(user=self.user)
        pdf = SimpleUploadedFile('test.pdf', b'%PDF-1.4 test', content_type='application/pdf')
        response = self.client.post('/api/attachments/', {
            'task': self.task.id,
            'file': pdf,
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_17_upload_exe_rejected(self):
        """Загрузка .exe запрещена."""
        self.client.force_authenticate(user=self.user)
        exe = SimpleUploadedFile('virus.exe', b'MZ...', content_type='application/octet-stream')
        response = self.client.post('/api/attachments/', {
            'task': self.task.id,
            'file': exe,
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)