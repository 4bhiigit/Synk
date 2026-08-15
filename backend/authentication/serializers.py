from rest_framework import serializers
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user profile representation."""
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'avatar_url',
            'is_online',
            'last_seen',
            'date_joined',
        ]
        read_only_fields = ['id', 'is_online', 'last_seen', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration with secure password hashing."""
    password = serializers.CharField(write_only=True, required=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'avatar_url',
            'password',
            'password_confirm',
        ]
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
        }

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.pop('password_confirm', None)
        if password_confirm and password != password_confirm:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for user login supporting both username or email authentication."""
    username_or_email = serializers.CharField(required=False)
    username = serializers.CharField(required=False)
    email = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        identifier = (
            attrs.get('username_or_email') or
            attrs.get('username') or
            attrs.get('email') or
            ''
        ).strip()
        password = attrs.get('password', '')

        if not identifier:
            raise serializers.ValidationError("Username or email is required.")

        user = None

        # 1. Try finding by email (case-insensitive)
        if '@' in identifier:
            user_obj = User.objects.filter(email__iexact=identifier).first()
            if user_obj and user_obj.check_password(password):
                user = user_obj

        # 2. Try finding by username (case-insensitive) if not already found
        if not user:
            user_obj = User.objects.filter(username__iexact=identifier).first()
            if user_obj and user_obj.check_password(password):
                user = user_obj

        # 3. Fallback to standard Django authenticate
        if not user:
            user = authenticate(username=identifier, password=password)

        if not user:
            raise serializers.ValidationError("Invalid credentials. Please check your username/email and password.")

        if not user.is_active:
            raise serializers.ValidationError("This account is currently disabled.")

        refresh = RefreshToken.for_user(user)

        return {
            'user': user,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }
