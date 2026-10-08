from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path(
        'api/token/refresh/',
        TokenRefreshView.as_view(),
        name='token_refresh',
    ),

    path(
        'api/password-reset/',
        auth_views.PasswordResetView.as_view(),
        name='password_reset',
    ),
    path(
        'api/password-reset/done/',
        auth_views.PasswordResetDoneView.as_view(),
        name='password_reset_done',
    ),
    path(
        'api/password-reset-confirm/<uidb64>/<token>/',
        auth_views.PasswordResetConfirmView.as_view(),
        name='password_reset_confirm',
    ),
    path(
        'api/password-reset-complete/',
        auth_views.PasswordResetCompleteView.as_view(),
        name='password_reset_complete',
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)