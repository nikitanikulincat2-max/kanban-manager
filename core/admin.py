from django.contrib import admin
from .models import (
    Workspace, WorkspaceMembership, Board, Column,
    Label, Task, Comment, TaskHistory,
)


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_by', 'created_at')
    search_fields = ('name',)


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'workspace', 'order')


@admin.register(Column)
class ColumnAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'board', 'order')


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'column', 'assignee', 'priority', 'due_date')
    list_filter = ('priority', 'column')
    search_fields = ('title', 'description')


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'author', 'created_at')


@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'color', 'workspace')


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'workspace', 'role')


@admin.register(TaskHistory)
class TaskHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'user', 'field_name', 'changed_at')