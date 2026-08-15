import os
import uuid
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db.models import Q, Sum
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser

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
from .serializers import (
    ChatRoomSerializer,
    MessageSerializer,
    CreateOrGetRoomSerializer,
    ExpenseSerializer,
    ExpenseSplitSerializer,
    MessageReactionSerializer,
    StorySerializer,
    CreateStorySerializer,
    StoryViewSerializer,
    PollSerializer,
    CreatePollSerializer,
)

User = get_user_model()


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


# ----------------------------------------------------
# 📊 LIVE POLLS VIEWS
# ----------------------------------------------------
class CreatePollView(APIView):
    """
    Creates a new interactive poll inside a chat room and broadcasts a message card.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id, *args, **kwargs):
        room = get_object_or_404(ChatRoom, id=room_id)
        if not room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this room.")

        if room.is_broadcast_only and not room.admins.filter(id=request.user.id).exists():
            raise PermissionDenied("Only channel administrators can create polls.")

        serializer = CreatePollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        poll = Poll.objects.create(
            room=room,
            created_by=request.user,
            question=data['question'].strip(),
            is_multiple_choice=data.get('is_multiple_choice', False),
            is_anonymous=data.get('is_anonymous', False),
        )

        for opt_text in data['options']:
            if opt_text.strip():
                PollOption.objects.create(poll=poll, text=opt_text.strip())

        # Create accompanying poll message
        msg = Message.objects.create(
            room=room,
            sender=request.user,
            content=poll.question,
            message_type='poll_card',
        )
        msg.read_by.add(request.user)

        return Response(
            MessageSerializer(msg, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class VotePollView(APIView):
    """
    Votes or toggles a vote on a specific poll option.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, poll_id, *args, **kwargs):
        poll = get_object_or_404(Poll, id=poll_id)
        if not poll.room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You must be a member of the chat to vote.")

        if poll.is_closed:
            return Response({'error': 'This poll has been closed.'}, status=status.HTTP_400_BAD_REQUEST)

        option_id = request.data.get('option_id')
        if not option_id:
            return Response({'error': 'option_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        option = get_object_or_404(PollOption, id=option_id, poll=poll)

        existing_vote = PollVote.objects.filter(poll=poll, option=option, user=request.user).first()

        if existing_vote:
            # Retract vote
            existing_vote.delete()
        else:
            if not poll.is_multiple_choice:
                # Remove any previous votes on this poll for single choice
                PollVote.objects.filter(poll=poll, user=request.user).delete()

            PollVote.objects.create(poll=poll, option=option, user=request.user)

        return Response(
            PollSerializer(poll, context={'request': request}).data,
            status=status.HTTP_200_OK
        )


class ClosePollView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, poll_id, *args, **kwargs):
        poll = get_object_or_404(Poll, id=poll_id)
        if poll.created_by_id != request.user.id and not poll.room.admins.filter(id=request.user.id).exists():
            raise PermissionDenied("Only the poll creator or channel admin can close this poll.")

        poll.is_closed = True
        poll.save(update_fields=['is_closed'])

        return Response(PollSerializer(poll, context={'request': request}).data, status=status.HTTP_200_OK)


# ----------------------------------------------------
# 📌 PINNED MESSAGES & CHANNELS HUB
# ----------------------------------------------------
class PinMessageView(APIView):
    """
    Pins or unpins a message within a chat room.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id, *args, **kwargs):
        room = get_object_or_404(ChatRoom, id=room_id)
        if not room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this room.")

        message_id = request.data.get('message_id')
        msg = get_object_or_404(Message, id=message_id, room=room)

        if room.pinned_messages.filter(id=msg.id).exists():
            room.pinned_messages.remove(msg)
            action = 'unpinned'
        else:
            room.pinned_messages.add(msg)
            action = 'pinned'

        return Response({
            'status': action,
            'message_id': str(msg.id),
            'pinned_count': room.pinned_messages.count(),
        }, status=status.HTTP_200_OK)


class PublicChannelsListView(generics.ListAPIView):
    """
    Public channel explorer and discovery directory.
    """
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get('search', '').strip()
        queryset = ChatRoom.objects.filter(is_public=True, room_type__in=['channel', 'supergroup'])

        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) |
                Q(channel_handle__icontains=query) |
                Q(description__icontains=query)
            )

        return queryset.order_by('-updated_at')[:30]


class JoinLeaveChannelView(APIView):
    """
    1-Click Join or Leave a public/broadcast channel.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id, *args, **kwargs):
        room = get_object_or_404(ChatRoom, id=room_id)

        if room.members.filter(id=request.user.id).exists():
            # Leave
            if room.admins.filter(id=request.user.id).exists() and room.admins.count() == 1:
                return Response({'error': 'Sole administrator cannot leave channel.'}, status=status.HTTP_400_BAD_REQUEST)
            room.members.remove(request.user)
            action = 'left'
        else:
            # Join
            room.members.add(request.user)
            action = 'joined'

        return Response({
            'status': action,
            'room_id': str(room.id),
            'subscribers_count': room.members.count(),
            'room': ChatRoomSerializer(room, context={'request': request}).data,
        }, status=status.HTTP_200_OK)


# ----------------------------------------------------
# 📱 24-HOUR STORIES / STATUS VIEWS
# ----------------------------------------------------
class StoryListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        now = timezone.now()
        current_user = request.user

        active_stories = (
            Story.objects.filter(expires_at__gt=now)
            .select_related('user')
            .prefetch_related('views', 'views__viewer', 'excluded_users', 'allowed_users')
            .order_by('created_at')
        )

        visible_stories = []
        for story in active_stories:
            if story.user_id == current_user.id:
                visible_stories.append(story)
            elif story.privacy_type == 'everyone':
                if not story.excluded_users.filter(id=current_user.id).exists():
                    visible_stories.append(story)
            elif story.privacy_type == 'exclude':
                if not story.excluded_users.filter(id=current_user.id).exists():
                    visible_stories.append(story)
            elif story.privacy_type == 'only_share_with':
                if story.allowed_users.filter(id=current_user.id).exists():
                    visible_stories.append(story)

        grouped = {}
        for story in visible_stories:
            uid = str(story.user_id)
            if uid not in grouped:
                grouped[uid] = {
                    'user': UserSerializer(story.user).data,
                    'is_self': story.user_id == current_user.id,
                    'stories': [],
                    'last_updated': story.created_at,
                }
            grouped[uid]['stories'].append(
                StorySerializer(story, context={'request': request}).data
            )
            grouped[uid]['last_updated'] = story.created_at

        story_groups = []
        my_group = None

        for uid, data in grouped.items():
            has_unseen = any(not s['is_viewed'] for s in data['stories'])
            data['has_unseen'] = has_unseen
            data['all_viewed'] = not has_unseen

            if data['is_self']:
                my_group = data
            else:
                story_groups.append(data)

        story_groups.sort(key=lambda g: (not g['has_unseen'], -g['last_updated'].timestamp()))

        result = []
        if my_group:
            result.append(my_group)
        result.extend(story_groups)

        return Response(result, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        serializer = CreateStorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        story = Story.objects.create(
            user=request.user,
            story_type=data.get('story_type', 'text'),
            content=data.get('content', '').strip(),
            media_url=data.get('media_url'),
            background_gradient=data.get('background_gradient', 'from-purple-600 to-indigo-700'),
            privacy_type=data.get('privacy_type', 'everyone'),
        )

        excluded_ids = data.get('excluded_user_ids', [])
        if excluded_ids:
            story.excluded_users.set(User.objects.filter(id__in=excluded_ids))

        allowed_ids = data.get('allowed_user_ids', [])
        if allowed_ids:
            story.allowed_users.set(User.objects.filter(id__in=allowed_ids))

        return Response(
            StorySerializer(story, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class StoryViewRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, story_id, *args, **kwargs):
        story = get_object_or_404(Story, id=story_id)
        if story.user_id != request.user.id:
            StoryView.objects.get_or_create(story=story, viewer=request.user)

        return Response({'status': 'viewed', 'story_id': str(story.id)}, status=status.HTTP_200_OK)


class StoryDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, story_id, *args, **kwargs):
        story = get_object_or_404(Story, id=story_id, user=request.user)
        story.delete()
        return Response({'status': 'deleted', 'story_id': str(story_id)}, status=status.HTTP_200_OK)


# ----------------------------------------------------
# 💬 CHAT ROOMS & MESSAGING VIEWS
# ----------------------------------------------------
class UserSearchView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get('search', '').strip()
        queryset = User.objects.exclude(id=self.request.user.id)

        if query:
            queryset = queryset.filter(
                Q(username__icontains=query) |
                Q(email__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query)
            )
        return queryset.order_by('username')[:20]


class ChatRoomListView(generics.ListAPIView):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            ChatRoom.objects.filter(members=self.request.user)
            .prefetch_related('members', 'admins', 'pinned_messages', 'messages', 'messages__sender', 'messages__read_by')
            .order_by('-updated_at')
        )


class CreateOrGetRoomView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CreateOrGetRoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        room_type = data.get('room_type', 'dm')
        is_group = data.get('is_group', False) or room_type in ['group', 'channel', 'supergroup']
        is_e2ee = data.get('is_e2ee', False)
        target_user_id = data.get('target_user_id')
        member_ids = data.get('member_ids', [])
        name = data.get('name')
        description = data.get('description', '')
        channel_handle = data.get('channel_handle', '').strip().lstrip('@')
        is_broadcast_only = data.get('is_broadcast_only', False) or room_type == 'channel'
        is_public = data.get('is_public', False)
        disappearing_timer = data.get('disappearing_timer', 0)

        if room_type == 'dm' and not is_group:
            if not target_user_id and not member_ids:
                return Response(
                    {"error": "target_user_id is required for direct messages."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            other_id = target_user_id or member_ids[0]
            if str(other_id) == str(request.user.id):
                return Response(
                    {"error": "Cannot create direct room with yourself."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            target_user = get_object_or_404(User, id=other_id)

            existing_room = (
                ChatRoom.objects.filter(room_type='dm', members=request.user)
                .filter(members=target_user)
                .first()
            )

            if existing_room:
                return Response(
                    ChatRoomSerializer(existing_room, context={'request': request}).data,
                    status=status.HTTP_200_OK
                )

            room = ChatRoom.objects.create(room_type='dm', is_group=False, is_e2ee=is_e2ee, disappearing_timer=disappearing_timer)
            room.members.add(request.user, target_user)
            return Response(
                ChatRoomSerializer(room, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )

        # Group, Channel, or Supergroup
        room = ChatRoom.objects.create(
            name=name or ("New Channel" if room_type == 'channel' else "New Group"),
            description=description,
            room_type=room_type,
            is_group=True,
            is_broadcast_only=is_broadcast_only,
            channel_handle=channel_handle or None,
            is_public=is_public,
            is_e2ee=is_e2ee,
            disappearing_timer=disappearing_timer
        )
        room.members.add(request.user)
        room.admins.add(request.user)

        for m_id in member_ids:
            try:
                u = User.objects.get(id=m_id)
                room.members.add(u)
            except User.DoesNotExist:
                continue

        return Response(
            ChatRoomSerializer(room, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class RoomMessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        room_id = self.kwargs.get('room_id')
        room = get_object_or_404(ChatRoom, id=room_id)

        if not room.members.filter(id=self.request.user.id).exists():
            raise PermissionDenied("You are not a member of this chat room.")

        now = timezone.now()
        return (
            Message.objects.filter(room=room, is_deleted=False)
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .exclude(deleted_by_users=self.request.user)
            .select_related('sender', 'reply_to', 'reply_to__sender')
            .prefetch_related('read_by', 'reactions', 'reactions__user', 'view_once_opened_by')
            .order_by('timestamp')
        )


class OpenViewOnceMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, message_id, *args, **kwargs):
        msg = get_object_or_404(Message, id=message_id)
        if not msg.room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this chat room.")

        if not msg.is_view_once:
            return Response({'error': 'Message is not a View Once media.'}, status=status.HTTP_400_BAD_REQUEST)

        if msg.sender_id != request.user.id and msg.view_once_opened_by.filter(id=request.user.id).exists():
            return Response({'error': 'This View Once media has already been viewed.'}, status=status.HTTP_410_GONE)

        actual_media_url = msg.media_url
        media_type = 'audio' if (msg.message_type == 'audio' or (actual_media_url and actual_media_url.endswith(('.webm', '.mp3', '.ogg', '.wav')))) else 'image'

        msg.view_once_opened_by.add(request.user)

        return Response({
            'message_id': str(msg.id),
            'media_url': actual_media_url,
            'media_type': media_type,
            'is_opened': True,
        }, status=status.HTTP_200_OK)


class SetRoomDisappearingTimerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id, *args, **kwargs):
        room = get_object_or_404(ChatRoom, id=room_id)
        if not room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this room.")

        timer_seconds = int(request.data.get('disappearing_timer', 0))
        room.disappearing_timer = timer_seconds
        room.save(update_fields=['disappearing_timer'])

        return Response({
            'room_id': str(room.id),
            'disappearing_timer': room.disappearing_timer,
        }, status=status.HTTP_200_OK)


class EditMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, message_id, *args, **kwargs):
        msg = get_object_or_404(Message, id=message_id)
        if msg.sender_id != request.user.id:
            raise PermissionDenied("You can only edit your own messages.")

        if msg.deleted_for_everyone:
            return Response({'error': 'Cannot edit a deleted message.'}, status=status.HTTP_400_BAD_REQUEST)

        time_diff = (timezone.now() - msg.timestamp).total_seconds()
        if time_diff > 900:  # 15 mins
            return Response({'error': 'Messages can only be edited within 15 minutes of sending.'}, status=status.HTTP_400_BAD_REQUEST)

        new_content = request.data.get('content', '').strip()
        if not new_content:
            return Response({'error': 'Message content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        msg.content = new_content
        msg.is_edited = True
        msg.edited_at = timezone.now()
        msg.save()

        return Response(MessageSerializer(msg, context={'request': request}).data, status=status.HTTP_200_OK)


class DeleteMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, message_id, *args, **kwargs):
        msg = get_object_or_404(Message, id=message_id)
        if not msg.room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this chat room.")

        mode = request.query_params.get('mode', 'for_me')

        if mode == 'for_everyone':
            if msg.sender_id != request.user.id and not msg.room.admins.filter(id=request.user.id).exists():
                raise PermissionDenied("You can only delete your own messages for everyone.")
            msg.deleted_for_everyone = True
            msg.content = "🚫 This message was deleted"
            msg.media_url = None
            msg.save()
            return Response({'status': 'deleted_for_everyone', 'id': str(msg.id)}, status=status.HTTP_200_OK)
        else:
            msg.deleted_by_users.add(request.user)
            return Response({'status': 'deleted_for_me', 'id': str(msg.id)}, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        message_ids = request.data.get('message_ids', [])
        mode = request.data.get('mode', 'for_me')

        if mode == 'for_everyone':
            messages = Message.objects.filter(id__in=message_ids, sender=request.user)
            messages.update(deleted_for_everyone=True, content="🚫 This message was deleted", media_url=None)
        else:
            messages = Message.objects.filter(id__in=message_ids)
            for m in messages:
                m.deleted_by_users.add(request.user)

        return Response({'deleted_count': len(message_ids), 'message_ids': message_ids}, status=status.HTTP_200_OK)


class MessageReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, message_id, *args, **kwargs):
        msg = get_object_or_404(Message, id=message_id)
        if not msg.room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this chat room.")

        emoji = request.data.get('emoji', '').strip()
        if not emoji:
            return Response({'error': 'Emoji is required.'}, status=status.HTTP_400_BAD_REQUEST)

        reaction = MessageReaction.objects.filter(message=msg, user=request.user).first()
        if reaction:
            if reaction.emoji == emoji:
                reaction.delete()
            else:
                reaction.emoji = emoji
                reaction.save()
        else:
            MessageReaction.objects.create(message=msg, user=request.user, emoji=emoji)

        updated_msg = Message.objects.prefetch_related('reactions', 'reactions__user').get(id=message_id)
        return Response(MessageSerializer(updated_msg, context={'request': request}).data, status=status.HTTP_200_OK)


class MarkRoomReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id, *args, **kwargs):
        room = get_object_or_404(ChatRoom, id=room_id)
        if not room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this chat room.")

        unread_messages = room.messages.exclude(read_by=request.user)
        for msg in unread_messages:
            msg.read_by.add(request.user)

        return Response({"status": "messages marked as read"}, status=status.HTTP_200_OK)


class SettleExpenseSplitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, split_id, *args, **kwargs):
        split = get_object_or_404(ExpenseSplit, id=split_id)
        room = split.expense.room

        if not room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this room.")

        split.is_settled = not split.is_settled
        split.settled_at = timezone.now() if split.is_settled else None
        split.save()

        return Response(
            ExpenseSerializer(split.expense, context={'request': request}).data,
            status=status.HTTP_200_OK
        )


class RoomExpenseSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, room_id, *args, **kwargs):
        room = get_object_or_404(ChatRoom, id=room_id)
        if not room.members.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this room.")

        expenses = Expense.objects.filter(room=room).prefetch_related('splits', 'splits__user', 'created_by')
        total_amount = sum(e.total_amount for e in expenses)

        unsettled_splits = ExpenseSplit.objects.filter(expense__room=room, is_settled=False).select_related('user', 'expense__created_by')
        total_unsettled = sum(s.amount_owed for s in unsettled_splits)

        member_balances = {}
        for member in room.members.all():
            member_balances[str(member.id)] = {
                'user': UserSerializer(member).data,
                'paid_total': 0.0,
                'owed_total': 0.0,
                'net_balance': 0.0,
            }

        for exp in expenses:
            creator_id = str(exp.created_by_id)
            if creator_id in member_balances:
                member_balances[creator_id]['paid_total'] += float(exp.total_amount)

            for split in exp.splits.all():
                uid = str(split.user_id)
                if uid in member_balances:
                    member_balances[uid]['owed_total'] += float(split.amount_owed)

        for uid, data in member_balances.items():
            data['net_balance'] = data['paid_total'] - data['owed_total']

        return Response({
            'room_id': str(room.id),
            'total_expenses_count': expenses.count(),
            'total_spent': float(total_amount),
            'total_unsettled': float(total_unsettled),
            'member_balances': list(member_balances.values()),
            'expenses': ExpenseSerializer(expenses, many=True, context={'request': request}).data,
        }, status=status.HTTP_200_OK)


class MediaUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(uploaded_file.name)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"

        upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)

        file_path = os.path.join(upload_dir, unique_name)
        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        media_url = request.build_absolute_uri(f"{settings.MEDIA_URL}uploads/{unique_name}")

        return Response({
            'url': media_url,
            'filename': uploaded_file.name,
            'size': uploaded_file.size,
        }, status=status.HTTP_201_CREATED)


class E2EEKeyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        public_key = request.data.get('public_key')
        if not public_key:
            return Response({'error': 'Public key is required.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.e2ee_public_key = public_key
        request.user.save(update_fields=['e2ee_public_key'])
        return Response({'status': 'key_updated'}, status=status.HTTP_200_OK)

    def get(self, request, user_id=None, *args, **kwargs):
        target_user = get_object_or_404(User, id=user_id or request.user.id)
        return Response({
            'user_id': str(target_user.id),
            'username': target_user.username,
            'public_key': target_user.e2ee_public_key,
        }, status=status.HTTP_200_OK)
