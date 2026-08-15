import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Custom User model using UUID as primary key, unique email,
    avatar URL, online presence tracking, and E2EE public key.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(auto_now=True)
    e2ee_public_key = models.TextField(blank=True, null=True)

    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.username or self.email
