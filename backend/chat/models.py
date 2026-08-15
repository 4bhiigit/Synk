import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal


class ChatRoom(models.Model):
    """
    Chat room supporting direct messages, group conversations,
    Telegram-style broadcast channels, supergroups, synchronized media sessions, and E2EE.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, default='')
    room_type = models.CharField(
        max_length=20,
        choices=[('dm', 'Direct Message'), ('group', 'Group Chat'), ('channel', 'Broadcast Channel'), ('supergroup', 'Supergroup')],
        default='dm'
    )
    is_group = models.BooleanField(default=False)
    is_broadcast_only = models.BooleanField(default=False) # Only admins can send in broadcast channels
    channel_handle = models.CharField(max_length=50, blank=True, null=True, unique=True)
    is_public = models.BooleanField(default=False)

    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='chat_rooms')
    admins = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='admin_rooms', blank=True)
    pinned_messages = models.ManyToManyField('Message', related_name='pinned_in_rooms', blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Disappearing Messages Timer (0=Off, 3600=1hr, 86400=24hr, 604800=7d)
    disappearing_timer = models.IntegerField(default=0)

    # Watch Together Session State
    active_video_url = models.URLField(max_length=500, blank=True, null=True)
    video_status = models.CharField(
        max_length=20,
        choices=[('PLAYING', 'Playing'), ('PAUSED', 'Paused'), ('STOPPED', 'Stopped')],
        default='STOPPED'
    )
    last_timestamp = models.FloatField(default=0.0)

    # E2EE & Vault State
    is_e2ee = models.BooleanField(default=False)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        if self.channel_handle:
            return f"Channel {self.channel_handle} ({self.name})"
        if self.name:
            return self.name
        member_names = ", ".join([user.username for user in self.members.all()[:3]])
        return f"Room ({member_names})"


class Message(models.Model):
    """
    Individual message sent within a ChatRoom.
    Supports text, media attachments, structured cards, quoted replies,
    edit tracking, soft delete, Delete for Everyone, View Once, and Time Capsule future reveals.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(blank=True, default='')
    media_url = models.URLField(max_length=500, blank=True, null=True)
    message_type = models.CharField(max_length=50, default='text') # 'text' | 'expense_card' | 'p2p_card' | 'game_card' | 'capsule_card' | 'poll_card' | 'audio' | 'system' | 'gif' | 'sticker'
    read_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='read_messages', blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    # Quoted Reply
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies'
    )

    # Edit & Delete Tracking
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_for_everyone = models.BooleanField(default=False)
    deleted_by_users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='deleted_messages', blank=True)
    is_forwarded = models.BooleanField(default=False)

    # View Once & Disappearing Message State
    is_view_once = models.BooleanField(default=False)
    view_once_opened_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='opened_view_once_messages', blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Time Capsule & Future Reveal State
    is_capsule = models.BooleanField(default=False)
    unlock_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_unlocked = models.BooleanField(default=False)
    locked_placeholder = models.CharField(max_length=255, default="🔒 This is a locked Time Capsule.")
    capsule_title = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.sender.username}: {self.content[:30]}"


class MessageReaction(models.Model):
    """
    Emoji reactions on messages (WhatsApp / Telegram style).
    One active emoji reaction per user per message.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_reactions')
    emoji = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user')
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user.username} reacted {self.emoji} to {self.message_id}"


class Story(models.Model):
    """
    24-Hour Stories / Status Updates (WhatsApp / Instagram style).
    Automatically expires 24 hours after creation.
    Supports text (custom gradient) and image/video media stories with granular privacy.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='stories')
    story_type = models.CharField(max_length=20, default='text') # 'text' | 'image' | 'video'
    content = models.TextField(blank=True, default='') # Text content or caption
    media_url = models.URLField(max_length=500, blank=True, null=True)
    background_gradient = models.CharField(max_length=100, default='from-purple-600 to-indigo-700')
    privacy_type = models.CharField(
        max_length=30,
        choices=[('everyone', 'Everyone'), ('exclude', 'My Contacts Except'), ('only_share_with', 'Only Share With')],
        default='everyone'
    )
    excluded_users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='excluded_stories', blank=True)
    allowed_users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='allowed_stories', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ['created_at']

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(hours=24)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username}'s Story ({self.story_type}) - Expires {self.expires_at.strftime('%H:%M')}"


class StoryView(models.Model):
    """
    Tracks individual views on a Story with timestamps.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='views')
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='viewed_stories')
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('story', 'viewer')
        ordering = ['-viewed_at']

    def __str__(self):
        return f"{self.viewer.username} viewed {self.story_id}"


class Poll(models.Model):
    """
    Interactive in-chat live poll (WhatsApp & Telegram style).
    Supports single or multiple choice, anonymous voting, and live vote tallies.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='polls')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_polls')
    question = models.CharField(max_length=300)
    is_multiple_choice = models.BooleanField(default=False)
    is_anonymous = models.BooleanField(default=False)
    is_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Poll: {self.question} ({self.votes.count()} votes)"


class PollOption(models.Model):
    """
    Individual voting option within a Poll.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=150)

    def __str__(self):
        return f"Option: {self.text}"


class PollVote(models.Model):
    """
    Individual vote cast on a PollOption.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes')
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='poll_votes')
    voted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('poll', 'option', 'user')

    def __str__(self):
        return f"{self.user.username} voted for {self.option.text}"


class Expense(models.Model):
    """
    Shared expense created within a room via slash commands (/split or /expense).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='expenses')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_expenses')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Expense: {self.description} (${self.total_amount})"


class ExpenseSplit(models.Model):
    """
    Individual participant's share of an Expense.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expense_splits')
    amount_owed = models.DecimalField(max_digits=12, decimal_places=2)
    is_settled = models.BooleanField(default=False)
    settled_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        status = "Paid" if self.is_settled else "Owed"
        return f"{self.user.username} - ${self.amount_owed} ({status})"
