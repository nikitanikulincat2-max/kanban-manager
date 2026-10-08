from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Workspace(models.Model):
    name = models.CharField(max_length=100)
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='owned_workspaces'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']   # ← добавить

    def __str__(self):
        return self.name

class WorkspaceMembership(models.Model):
    ROLE_CHOICES = [
        ('member', 'Участник'),
        ('manager', 'Менеджер'),
    ]
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='memberships',           # ← обязательно
    )
    workspace = models.ForeignKey(
        'Workspace',
        on_delete=models.CASCADE,
        related_name='memberships',           # ← обязательно
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='member',
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'workspace')
        ordering = ['joined_at']

    def __str__(self):
        return f'{self.user.username} — {self.workspace.name} ({self.role})'

class Board(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='boards')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name

class Column(models.Model):
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='columns')
    name = models.CharField(max_length=50)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name

class Label(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='labels')
    name = models.CharField(max_length=30)
    color = models.CharField(max_length=7, default='#007bff')  # hex

    def __str__(self):
        return self.name

class Task(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    column = models.ForeignKey(Column, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tasks')
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    labels = models.ManyToManyField(Label, blank=True)
    # Для загрузки файлов (опционально)
    attachment = models.FileField(upload_to='attachments/', null=True, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title

class Comment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Comment by {self.author} on {self.task}'

class TaskHistory(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='history')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    field_name = models.CharField(max_length=50)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.field_name} changed at {self.changed_at}'

class Attachment(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file = models.FileField(upload_to='attachments/%Y/%m/')
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='uploaded_attachments',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f'{self.file.name} → {self.task.title}'