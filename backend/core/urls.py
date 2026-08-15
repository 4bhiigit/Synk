"""
Global URL Configuration for core project.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import JsonResponse

def api_root_view(request):
    return JsonResponse({
        "status": "healthy",
        "message": "Nexus Real-Time Chat API & WebSocket Server",
        "frontend_url": "http://localhost:5173",
        "endpoints": {
            "auth": {
                "register": "/api/auth/register/",
                "login": "/api/auth/login/",
                "me": "/api/auth/me/",
                "token_refresh": "/api/auth/token/refresh/",
            },
            "chat": {
                "users_search": "/api/chat/users/?search=<query>",
                "rooms_list": "/api/chat/rooms/",
                "room_get_or_create": "/api/chat/rooms/get-or-create/",
                "room_messages": "/api/chat/rooms/<room_id>/messages/?page=1",
                "room_mark_read": "/api/chat/rooms/<room_id>/mark-read/",
                "media_upload": "/api/chat/upload/",
            },
            "websocket": "ws://127.0.0.1:8000/ws/chat/<room_id>/?token=<jwt_access_token>"
        }
    })

def health_check_view(request):
    """
    Production health check probe for load balancers and uptime monitoring.
    """
    import time
    from django.db import connection
    from channels.layers import get_channel_layer
    
    db_status = "healthy"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        
    channel_status = "healthy"
    try:
        layer = get_channel_layer()
        if not layer:
            channel_status = "unconfigured"
    except Exception as e:
        channel_status = f"unhealthy: {str(e)}"

    is_healthy = db_status == "healthy"
    status_code = 200 if is_healthy else 503

    return JsonResponse({
        "status": "healthy" if is_healthy else "degraded",
        "timestamp": time.time(),
        "services": {
            "database": db_status,
            "channel_layer": channel_status,
        }
    }, status=status_code)

urlpatterns = [
    path('', api_root_view, name='api_root_home'),
    path('api/', api_root_view, name='api_root'),
    path('api/health/', health_check_view, name='api_health_check'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/chat/', include('chat.urls')),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
