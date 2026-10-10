from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    WorkspaceViewSet, BoardViewSet, ColumnViewSet,
    TaskViewSet, CommentViewSet, LabelViewSet, UserViewSet,
    AttachmentViewSet, RegisterView, rate_limited_login, TaskGroupViewSet,
)

router = DefaultRouter()
router.register(r'workspaces', WorkspaceViewSet, basename='workspace')
router.register(r'boards', BoardViewSet, basename='board')
router.register(r'columns', ColumnViewSet, basename='column')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'labels', LabelViewSet, basename='label')
router.register(r'users', UserViewSet, basename='user')
router.register(r'attachments', AttachmentViewSet, basename='attachment')
router.register(r'groups', TaskGroupViewSet, basename='group')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', rate_limited_login, name='token_obtain_pair'),
    path('', include(router.urls)),
]