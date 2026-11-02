from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import (
    Workspace, WorkspaceMembership, Board, Column, Task,
    TaskGroup, TaskGroupMembership, Comment, TaskHistory, Attachment
)


class BaseAPITestCase(APITestCase):
    """Базовый класс для настройки тестовых данных."""

    def setUp(self):
        self.admin = User.objects.create_superuser(username='admin', password='AdminPass123')
        self.manager = User.objects.create_user(username='manager', password='ManagerPass123')
        self.member = User.objects.create_user(username='member', password='MemberPass123')
        self.other_user = User.objects.create_user(username='other', password='OtherPass123')
        self.workspace = Workspace.objects.create(name='Test WS', created_by=self.manager)
        WorkspaceMembership.objects.create(user=self.manager, workspace=self.workspace, role='manager')
        WorkspaceMembership.objects.create(user=self.member, workspace=self.workspace, role='member')
        WorkspaceMembership.objects.create(user=self.other_user, workspace=self.workspace, role='member')

        self.board = Board.objects.create(workspace=self.workspace, name='Test Board')
        self.col_todo = Column.objects.create(board=self.board, name='К выполнению', order=0)
        self.col_in_progress = Column.objects.create(board=self.board, name='В работе', order=1)
        self.task = Task.objects.create(
            column=self.col_todo,
            title='Test Task',
            created_by=self.manager,
            visibility='public'
        )


class AuthTestCase(BaseAPITestCase):
    """TC-01 - TC-06: Аутентификация и Пользователи"""

    def test_tc01_02_register(self):
        res = self.client.post('/api/register/', {
            'username': 'newuser', 'email': 'new@ex.com', 'password': 'StrongPass123', 'password2': 'StrongPass123'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        res = self.client.post('/api/register/', {
            'username': 'newuser', 'email': 'new2@ex.com', 'password': 'StrongPass123', 'password2': 'StrongPass123'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tc03_04_login(self):
        res = self.client.post('/api/token/', {'username': 'manager', 'password': 'ManagerPass123'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        res = self.client.post('/api/token/', {'username': 'manager', 'password': 'WrongPass'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tc05_api_without_token(self):
        res = self.client.get('/api/workspaces/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tc06_user_me(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.get('/api/users/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'member')


class WorkspaceAndRBACTestCase(BaseAPITestCase):
    """TC-07 - TC-12: Пространства и Роли"""

    def test_tc07_create_workspace(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.post('/api/workspaces/', {'name': 'New Workspace'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        ws_id = res.data['id']
        membership = WorkspaceMembership.objects.get(user=self.member, workspace_id=ws_id)
        self.assertEqual(membership.role, 'manager')

    def test_tc08_09_invite_and_change_role(self):
        self.client.force_authenticate(user=self.manager)
        res = self.client.post(f'/api/workspaces/{self.workspace.id}/add_member/', {
            'user_id': self.other_user.id, 'role': 'member'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.post(f'/api/workspaces/{self.workspace.id}/add_member/', {
            'user_id': self.other_user.id, 'role': 'manager'
        })
        membership = WorkspaceMembership.objects.get(user=self.other_user, workspace=self.workspace)
        self.assertEqual(membership.role, 'manager')

    def test_tc10_delete_creator_forbidden(self):
        self.client.force_authenticate(user=self.manager)
        res = self.client.delete(f'/api/workspaces/{self.workspace.id}/remove_member/?user_id={self.manager.id}')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tc11_tc12_delete_workspace(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.delete(f'/api/workspaces/{self.workspace.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.manager)
        res = self.client.delete(f'/api/workspaces/{self.workspace.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)


class BoardAndTaskCRUDTestCase(BaseAPITestCase):
    """TC-13 - TC-21: Доски, Колонки, Задачи и Drag&Drop"""

    def test_tc13_14_create_board(self):
        self.client.force_authenticate(user=self.manager)
        res = self.client.post('/api/boards/', {'workspace': self.workspace.id, 'name': 'New Board'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_board_id = res.data['id']
        self.assertEqual(Column.objects.filter(board_id=new_board_id).count(), 3)
        self.client.force_authenticate(user=self.member)
        res = self.client.post('/api/boards/', {'workspace': self.workspace.id, 'name': 'Hack Board'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_tc15_16_create_task_validation(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.post('/api/tasks/', {'column': self.col_todo.id, 'title': 'Member Task'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        res = self.client.post('/api/tasks/', {'column': self.col_todo.id, 'title': ''})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tc17_edit_own_task(self):
        self.client.force_authenticate(user=self.manager)
        res = self.client.patch(f'/api/tasks/{self.task.id}/', {'title': 'Updated Title'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, 'Updated Title')

    def test_tc18_19_delete_task(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.delete(f'/api/tasks/{self.task.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.manager)
        res = self.client.delete(f'/api/tasks/{self.task.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_tc20_21_drag_and_drop(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.post(f'/api/tasks/{self.task.id}/move/', {'column_id': self.col_in_progress.id})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.manager)
        res = self.client.post(f'/api/tasks/{self.task.id}/move/', {'column_id': self.col_in_progress.id, 'order': 0})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.task.refresh_from_db()
        self.assertEqual(self.task.column_id, self.col_in_progress.id)


class TaskVisibilityTestCase(BaseAPITestCase):
    """TC-22 - TC-27: Механизм видимости задач"""

    def _get_tasks(self, user):
        self.client.force_authenticate(user=user)
        res = self.client.get('/api/tasks/')
        return res.data['results'] if 'results' in res.data else res.data

    def test_tc22_public_visibility(self):
        self.task.visibility = 'public'
        self.task.save()
        tasks = self._get_tasks(self.other_user)
        self.assertEqual(len(tasks), 1)

    def test_tc23_private_visibility(self):
        self.task.visibility = 'private'
        self.task.save()
        self.assertEqual(len(self._get_tasks(self.manager)), 1)
        self.assertEqual(len(self._get_tasks(self.member)), 0)

    def test_tc24_25_users_visibility(self):
        self.task.visibility = 'users'
        self.task.save()
        self.task.visible_to_users.add(self.member)
        self.assertEqual(len(self._get_tasks(self.member)), 1)
        self.assertEqual(len(self._get_tasks(self.other_user)), 0)

    def test_tc26_group_visibility(self):
        group = TaskGroup.objects.create(workspace=self.workspace, name='Backend', created_by=self.manager)
        TaskGroupMembership.objects.create(group=group, user=self.member)
        self.task.visibility = 'group'
        self.task.group = group
        self.task.save()
        self.assertEqual(len(self._get_tasks(self.member)), 1)
        self.assertEqual(len(self._get_tasks(self.other_user)), 0)

    def test_tc27_change_visibility(self):
        self.client.force_authenticate(user=self.manager)
        res = self.client.patch(f'/api/tasks/{self.task.id}/', {
            'visibility': 'private'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.task.refresh_from_db()
        self.assertEqual(self.task.visibility, 'private')


class CommentsAndAttachmentsTestCase(BaseAPITestCase):
    """TC-28 - TC-31: Комментарии и Файлы"""

    def test_tc28_comment_add(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.post('/api/comments/', {'task': self.task.id, 'text': 'Test Comment'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 1)

    def test_tc29_upload_pdf(self):
        self.client.force_authenticate(user=self.member)
        pdf = SimpleUploadedFile('test.pdf', b'%PDF-1.4 test', content_type='application/pdf')
        res = self.client.post('/api/attachments/', {'task': self.task.id, 'file': pdf}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Attachment.objects.count(), 1)

    def test_tc30_reject_exe(self):
        self.client.force_authenticate(user=self.member)
        exe = SimpleUploadedFile('virus.exe', b'MZ...', content_type='application/octet-stream')
        res = self.client.post('/api/attachments/', {'task': self.task.id, 'file': exe}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_tc31_reject_large_file(self):
        self.client.force_authenticate(user=self.member)
        large_file = SimpleUploadedFile('large.pdf', b'0' * (11 * 1024 * 1024), content_type='application/pdf')
        res = self.client.post('/api/attachments/', {'task': self.task.id, 'file': large_file}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class TaskHistoryTestCase(BaseAPITestCase):
    """TC-32: История изменений"""

    def test_tc32_history_generation(self):
        self.client.force_authenticate(user=self.manager)
        self.client.patch(f'/api/tasks/{self.task.id}/', {'priority': 'high'})
        history = TaskHistory.objects.filter(task=self.task)
        self.assertTrue(history.exists())
        record = history.last()
        self.assertEqual(record.field_name, 'Приоритет')
        self.assertEqual(record.new_value, 'Высокий')