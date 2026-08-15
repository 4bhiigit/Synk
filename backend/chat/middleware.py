import urllib.parse
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

User = get_user_model()


@database_sync_to_async
def get_user_from_jwt(token_string):
    """
    Decodes the JWT token and fetches the corresponding active User.
    """
    if not token_string:
        return AnonymousUser()
    try:
        access_token = AccessToken(token_string)
        user_id = access_token.get('user_id')
        if not user_id:
            return AnonymousUser()
        user = User.objects.get(id=user_id)
        if not user.is_active:
            return AnonymousUser()
        return user
    except (InvalidToken, TokenError, User.DoesNotExist, Exception):
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """
    Custom WebSocket middleware that extracts JWT access token from:
    1. Query string: ?token=<token>
    2. Subprotocol header: Sec-WebSocket-Protocol
    3. Authorization header: Bearer <token>
    """
    async def __call__(self, scope, receive, send):
        token = None

        # 1. Check Query String
        query_string = scope.get('query_string', b'').decode('utf-8')
        if query_string:
            query_params = urllib.parse.parse_qs(query_string)
            token_list = query_params.get('token', [])
            if token_list:
                token = token_list[0]

        # 2. Check Subprotocols fallback
        if not token:
            subprotocols = scope.get('subprotocols', [])
            if subprotocols:
                token = subprotocols[0]

        # 3. Check Headers fallback
        if not token:
            headers = dict(scope.get('headers', []))
            if b'authorization' in headers:
                try:
                    auth_header = headers[b'authorization'].decode('utf-8')
                    if auth_header.startswith('Bearer '):
                        token = auth_header.split(' ')[1]
                except Exception:
                    pass

        scope['user'] = await get_user_from_jwt(token)
        return await super().__call__(scope, receive, send)


def TokenAuthMiddlewareStack(inner):
    """Helper function to wrap inner ASGI application."""
    return TokenAuthMiddleware(inner)
