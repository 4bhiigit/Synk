from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from authentication.serializers import UserSerializer
from .models import (
    ChatRoom,
    Message,
    Expense,
    ExpenseSplit,
    MessageReaction,
    Story,
    StoryView,
    Poll,
    PollOption,
    PollVote,
)

User = get_user_model()


# ----------------------------------------------------
# 📊 POLLS SERIALIZERS
# ----------------------------------------------------
class PollOptionSerializer(serializers.ModelSerializer):
    votes_count = serializers.SerializerMethodField()
    voters = serializers.SerializerMethodField()
    is_voted_by_me = serializers.SerializerMethodField()
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = PollOption
        fields = ['id', 'text', 'votes_count', 'voters', 'is_voted_by_me', 'percentage']

    def get_votes_count(self, obj):
        return obj.votes.count()

    def get_voters(self, obj):
        if obj.poll.is_anonymous:
            return []
        return [v.user.username for v in obj.votes.all().select_related('user')[:10]]

    def get_is_voted_by_me(self, obj):
        request = self.context.get('request')
        user = self.context.get('user') or (request.user if request and request.user.is_authenticated else None)
        if user and user.is_authenticated:
            return obj.votes.filter(user=user).exists()
        return False

    def get_percentage(self, obj):
        total = obj.poll.votes.count()
        if total == 0:
            return 0
        return round((obj.votes.count() / total) * 100, 1)


class PollSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    options = PollOptionSerializer(many=True, read_only=True)
    total_votes = serializers.SerializerMethodField()
    my_voted_option_ids = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = [
            'id',
            'room',
            'created_by',
            'question',
            'is_multiple_choice',
            'is_anonymous',
            'is_closed',
            'options',
            'total_votes',
            'my_voted_option_ids',
            'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_total_votes(self, obj):
        return obj.votes.count()

    def get_my_voted_option_ids(self, obj):
        request = self.context.get('request')
        user = self.context.get('user') or (request.user if request and request.user.is_authenticated else None)
        if user and user.is_authenticated:
            return list(obj.votes.filter(user=user).values_list('option_id', flat=True))
        return []


class CreatePollSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=300)
    options = serializers.ListField(child=serializers.CharField(max_length=150), min_length=2, max_length=10)
    is_multiple_choice = serializers.BooleanField(default=False)
    is_anonymous = serializers.BooleanField(default=False)


# ----------------------------------------------------
# 📱 24-HOUR STORIES SERIALIZERS
# ----------------------------------------------------
class StoryViewSerializer(serializers.ModelSerializer):
    viewer = UserSerializer(read_only=True)

    class Meta:
        model = StoryView
        fields = ['id', 'viewer', 'viewed_at']


class StorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    is_viewed = serializers.SerializerMethodField()
    views_count = serializers.SerializerMethodField()
    views = serializers.SerializerMethodField()
    is_self = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = [
            'id',
            'user',
            'story_type',
            'content',
            'media_url',
            'background_gradient',
            'privacy_type',
            'is_viewed',
            'views_count',
            'views',
            'is_self',
            'created_at',
            'expires_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'expires_at']

    def get_is_self(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.user_id == request.user.id
        return False

    def get_is_viewed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.views.filter(viewer=request.user).exists()
        return False

    def get_views_count(self, obj):
        return obj.views.count()

    def get_views(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and obj.user_id == request.user.id:
            return StoryViewSerializer(obj.views.all().select_related('viewer')[:50], many=True).data
        return []


class CreateStorySerializer(serializers.ModelSerializer):
    excluded_user_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    allowed_user_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    caption = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Story
        fields = [
            'story_type',
            'content',
            'caption',
            'media_url',
            'background_gradient',
            'privacy_type',
            'excluded_user_ids',
            'allowed_user_ids',
        ]
        extra_kwargs = {
            'content': {'required': False, 'allow_blank': True},
            'media_url': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        caption = attrs.pop('caption', None)
        if not attrs.get('content') and caption:
            attrs['content'] = caption
        return attrs


# ----------------------------------------------------
# 💬 CHAT MESSAGES & REACTION SERIALIZERS
# ----------------------------------------------------
class MessageReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = MessageReaction
        fields = ['id', 'user', 'emoji', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class SimpleReplyMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_avatar = serializers.CharField(source='sender.avatar_url', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id',
            'sender_id',
            'sender_username',
            'sender_avatar',
            'content',
            'media_url',
            'message_type',
        ]


class ExpenseSplitSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = [
            'id',
            'user',
            'amount_owed',
            'is_settled',
            'settled_at',
        ]
        read_only_fields = ['id', 'user', 'amount_owed', 'settled_at']


class ExpenseSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    settled_count = serializers.SerializerMethodField()
    total_splits = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            'id',
            'room',
            'created_by',
            'total_amount',
            'description',
            'created_at',
            'splits',
            'settled_count',
            'total_splits',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_settled_count(self, obj):
        return obj.splits.filter(is_settled=True).count()

    def get_total_splits(self, obj):
        return obj.splits.count()


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    sender_id = serializers.UUIDField(write_only=True, required=False)
    reply_to = SimpleReplyMessageSerializer(read_only=True)
    reply_to_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    is_self = serializers.SerializerMethodField()
    read_by_count = serializers.SerializerMethodField()
    expense_data = serializers.SerializerMethodField()
    poll_data = serializers.SerializerMethodField()
    is_locked_for_me = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    media_url = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()
    delivery_status = serializers.SerializerMethodField()
    is_deleted_for_me = serializers.SerializerMethodField()
    is_view_once_opened = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id',
            'room',
            'sender',
            'sender_id',
            'content',
            'media_url',
            'message_type',
            'reply_to',
            'reply_to_id',
            'is_edited',
            'edited_at',
            'is_deleted',
            'deleted_for_everyone',
            'is_deleted_for_me',
            'is_forwarded',
            'is_view_once',
            'is_view_once_opened',
            'expires_at',
            'reactions',
            'delivery_status',
            'is_capsule',
            'unlock_at',
            'is_unlocked',
            'capsule_title',
            'is_locked_for_me',
            'expense_data',
            'poll_data',
            'read_by',
            'read_by_count',
            'timestamp',
            'is_self',
        ]
        read_only_fields = [
            'id',
            'timestamp',
            'read_by',
            'sender',
            'is_edited',
            'edited_at',
            'is_deleted',
            'deleted_for_everyone',
            'is_unlocked',
        ]

    def get_is_self(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False

    def get_read_by_count(self, obj):
        return obj.read_by.count()

    def get_is_deleted_for_me(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.deleted_by_users.filter(id=request.user.id).exists()
        return False

    def get_is_view_once_opened(self, obj):
        if not obj.is_view_once:
            return False
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if obj.sender_id == request.user.id:
                return obj.view_once_opened_by.exclude(id=request.user.id).exists()
            return obj.view_once_opened_by.filter(id=request.user.id).exists()
        return False

    def get_is_locked_for_me(self, obj):
        if not obj.is_capsule or obj.is_unlocked:
            return False
        if obj.unlock_at and timezone.now() >= obj.unlock_at:
            return False
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender_id != request.user.id
        return True

    def get_content(self, obj):
        if obj.deleted_for_everyone:
            return "🚫 This message was deleted"

        request = self.context.get('request')
        if request and request.user.is_authenticated and obj.deleted_by_users.filter(id=request.user.id).exists():
            return ""

        if obj.is_capsule and not obj.is_unlocked:
            if obj.unlock_at and timezone.now() < obj.unlock_at:
                if not request or not request.user.is_authenticated or obj.sender_id != request.user.id:
                    return obj.locked_placeholder
        return obj.content

    def get_media_url(self, obj):
        if obj.deleted_for_everyone:
            return None

        request = self.context.get('request')
        if request and request.user.is_authenticated and obj.deleted_by_users.filter(id=request.user.id).exists():
            return None

        if obj.is_view_once:
            if request and request.user.is_authenticated:
                if obj.sender_id != request.user.id and obj.view_once_opened_by.filter(id=request.user.id).exists():
                    return None

        if obj.is_capsule and not obj.is_unlocked:
            if obj.unlock_at and timezone.now() < obj.unlock_at:
                if not request or not request.user.is_authenticated or obj.sender_id != request.user.id:
                    return None
        return obj.media_url

    def get_reactions(self, obj):
        request = self.context.get('request')
        current_user_id = request.user.id if (request and request.user.is_authenticated) else None

        reactions_map = {}
        for r in obj.reactions.all().select_related('user'):
            emoji = r.emoji
            if emoji not in reactions_map:
                reactions_map[emoji] = {
                    'emoji': emoji,
                    'count': 0,
                    'users': [],
                    'user_ids': [],
                    'reacted_by_me': False,
                }
            reactions_map[emoji]['count'] += 1
            reactions_map[emoji]['users'].append(r.user.username)
            reactions_map[emoji]['user_ids'].append(str(r.user.id))
            if current_user_id and r.user.id == current_user_id:
                reactions_map[emoji]['reacted_by_me'] = True

        return list(reactions_map.values())

    def get_delivery_status(self, obj):
        other_readers = obj.read_by.exclude(id=obj.sender_id)
        if other_readers.exists():
            return 'read'
        return 'delivered'

    def get_expense_data(self, obj):
        if obj.message_type == 'expense_card':
            try:
                expense = obj.room.expenses.filter(created_at__lte=obj.timestamp).order_by('-created_at').first()
                if expense:
                    return ExpenseSerializer(expense, context=self.context).data
            except Exception:
                return None
        return None

    def get_poll_data(self, obj):
        if obj.message_type == 'poll_card':
            try:
                poll = obj.room.polls.filter(created_at__lte=obj.timestamp + timezone.timedelta(seconds=5)).order_by('-created_at').first()
                if poll:
                    return PollSerializer(poll, context=self.context).data
            except Exception:
                return None
        return None


class PinnedMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender_id', 'sender_username', 'content', 'media_url', 'message_type', 'timestamp']


class ChatRoomSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    admins = UserSerializer(many=True, read_only=True)
    pinned_messages = PinnedMessageSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_member = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    display_avatar = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    subscribers_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            'id',
            'name',
            'description',
            'room_type',
            'is_group',
            'is_broadcast_only',
            'channel_handle',
            'is_public',
            'is_e2ee',
            'disappearing_timer',
            'members',
            'admins',
            'is_admin',
            'subscribers_count',
            'pinned_messages',
            'created_at',
            'updated_at',
            'last_message',
            'unread_count',
            'other_member',
            'display_name',
            'display_avatar',
            'active_video_url',
            'video_status',
            'last_timestamp',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_admin(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.admins.filter(id=request.user.id).exists()
        return False

    def get_subscribers_count(self, obj):
        return obj.members.count()

    def get_last_message(self, obj):
        latest = obj.messages.filter(is_deleted=False).order_by('-timestamp').first()
        if latest:
            content_snippet = latest.content
            if latest.deleted_for_everyone:
                content_snippet = "🚫 This message was deleted"
            elif latest.message_type == 'poll_card':
                content_snippet = f"📊 Poll: {latest.content}"
            elif latest.is_view_once:
                content_snippet = "① Photo (View Once)" if (latest.media_url and not latest.media_url.endswith(('.webm', '.mp3'))) else "① View Once Media"
            elif latest.is_capsule and not latest.is_unlocked and latest.unlock_at and timezone.now() < latest.unlock_at:
                content_snippet = "🔒 Time Capsule"

            return {
                'id': str(latest.id),
                'content': content_snippet,
                'media_url': latest.media_url if (not latest.is_capsule and not latest.deleted_for_everyone and not latest.is_view_once) else None,
                'message_type': latest.message_type,
                'is_view_once': latest.is_view_once,
                'sender_id': str(latest.sender_id),
                'sender_username': latest.sender.username,
                'timestamp': latest.timestamp.isoformat(),
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.exclude(read_by=request.user).exclude(sender=request.user).count()
        return 0

    def get_other_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and obj.room_type == 'dm':
            other = obj.members.exclude(id=request.user.id).first()
            if other:
                return UserSerializer(other).data
        return None

    def get_display_name(self, obj):
        if obj.name:
            return obj.name
        if obj.channel_handle:
            return f"@{obj.channel_handle}"
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            other = obj.members.exclude(id=request.user.id).first()
            if other:
                return other.first_name and f"{other.first_name} {other.last_name}".strip() or other.username
        return obj.name or "Chat"

    def get_display_avatar(self, obj):
        if obj.room_type == 'dm':
            request = self.context.get('request')
            if request and request.user.is_authenticated:
                other = obj.members.exclude(id=request.user.id).first()
                if other:
                    return other.avatar_url
        return None


class CreateOrGetRoomSerializer(serializers.Serializer):
    target_user_id = serializers.UUIDField(required=False)
    member_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False
    )
    name = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    room_type = serializers.CharField(default='dm') # 'dm' | 'group' | 'channel' | 'supergroup'
    is_group = serializers.BooleanField(default=False)
    is_broadcast_only = serializers.BooleanField(default=False)
    channel_handle = serializers.CharField(required=False, allow_blank=True)
    is_public = serializers.BooleanField(default=False)
    is_e2ee = serializers.BooleanField(default=False)
    disappearing_timer = serializers.IntegerField(default=0, required=False)
