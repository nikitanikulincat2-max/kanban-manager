from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Workspace, WorkspaceMembership, Board, Column, Label,
    Task, Comment, TaskHistory, Attachment
)

class UserSerializer(serializers.ModelSerializer):
    is_manager = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_superuser', 'is_manager',
        ]

    def get_is_manager(self, obj):
        return (
            obj.is_superuser
            or obj.groups.filter(name='Managers').exists()
        )

class UserSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = ['id', 'user', 'role', 'joined_at']


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ['id', 'name', 'color']


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'task', 'author', 'text', 'created_at']


class TaskHistorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = TaskHistory
        fields = ['id', 'task', 'user', 'field_name', 'old_value',
                  'new_value', 'changed_at']

class WorkspaceSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    memberships = WorkspaceMembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Workspace
        fields = ['id', 'name', 'created_by', 'created_at', 'memberships']


class BoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = ['id', 'workspace', 'name', 'description', 'created_at', 'order']


class ColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = Column
        fields = ['id', 'board', 'name', 'order']

class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ['id', 'task', 'file', 'file_url', 'uploaded_by', 'uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

class TaskSerializer(serializers.ModelSerializer):
    assignee = UserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee',
        queryset=User.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    created_by = UserSerializer(read_only=True)
    labels = LabelSerializer(many=True, read_only=True)
    comments_count = serializers.IntegerField(
        source='comments.count', read_only=True
    )

    class Meta:
        model = Task
        fields = [
            'id', 'column', 'title', 'description',
            'assignee', 'assignee_id', 'created_by',
            'due_date', 'priority', 'order',
            'created_at', 'updated_at',
            'labels', 'comments_count',
        ]

class TaskDetailSerializer(TaskSerializer):
    comments = CommentSerializer(many=True, read_only=True)
    history = TaskHistorySerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta(TaskSerializer.Meta):
        fields = TaskSerializer.Meta.fields + ['comments', 'history', 'attachments']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError('Пароли не совпадают')
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        return user