from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer


class RegisterView(generics.CreateAPIView):
    """
    Register a new user account and immediately return JWT tokens + profile.
    """
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT tokens for immediate login
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'message': 'Registration successful.',
                'user': UserSerializer(user, context={'request': request}).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """
    Authenticate user via username/email and password, returning JWT tokens + profile.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        user = validated_data['user']

        return Response(
            {
                'message': 'Login successful.',
                'user': UserSerializer(user, context={'request': request}).data,
                'tokens': {
                    'access': validated_data['access'],
                    'refresh': validated_data['refresh'],
                },
            },
            status=status.HTTP_200_OK,
        )


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """
    Get or update the currently authenticated user's profile.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
