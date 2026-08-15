"""
ASGI config for core project with Django Channels, Daphne, and JWT WebSocket Auth.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from chat.middleware import TokenAuthMiddlewareStack
import chat.routing

django_http_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_http_app,
    "websocket": TokenAuthMiddlewareStack(
        URLRouter(
            chat.routing.websocket_urlpatterns
        )
    ),
})
