from django.urls import path
from .views import (
    UserSearchView,
    ChatRoomListView,
    CreateOrGetRoomView,
    RoomMessageListView,
    EditMessageView,
    DeleteMessageView,
    MessageReactionView,
    OpenViewOnceMessageView,
    SetRoomDisappearingTimerView,
    MarkRoomReadView,
    SettleExpenseSplitView,
    RoomExpenseSummaryView,
    MediaUploadView,
    E2EEKeyView,
    StoryListCreateView,
    StoryViewRecordView,
    StoryDeleteView,
    CreatePollView,
    VotePollView,
    ClosePollView,
    PinMessageView,
    PublicChannelsListView,
    JoinLeaveChannelView,
)

urlpatterns = [
    # 24-Hour Stories / Status
    path('stories/', StoryListCreateView.as_view(), name='chat_stories_list_create'),
    path('stories/<uuid:story_id>/view/', StoryViewRecordView.as_view(), name='chat_story_view'),
    path('stories/<uuid:story_id>/', StoryDeleteView.as_view(), name='chat_story_delete'),

    # Channels & Discovery Hub
    path('channels/public/', PublicChannelsListView.as_view(), name='chat_public_channels'),
    path('channels/<uuid:room_id>/join-leave/', JoinLeaveChannelView.as_view(), name='chat_join_leave_channel'),

    # Interactive Polls
    path('rooms/<uuid:room_id>/polls/', CreatePollView.as_view(), name='chat_create_poll'),
    path('polls/<uuid:poll_id>/vote/', VotePollView.as_view(), name='chat_vote_poll'),
    path('polls/<uuid:poll_id>/close/', ClosePollView.as_view(), name='chat_close_poll'),

    # Users & Rooms
    path('users/', UserSearchView.as_view(), name='chat_user_search'),
    path('rooms/', ChatRoomListView.as_view(), name='chat_room_list'),
    path('rooms/get-or-create/', CreateOrGetRoomView.as_view(), name='chat_room_get_or_create'),
    path('rooms/<uuid:room_id>/messages/', RoomMessageListView.as_view(), name='chat_room_messages'),
    path('rooms/<uuid:room_id>/pin/', PinMessageView.as_view(), name='chat_pin_message'),
    path('rooms/<uuid:room_id>/disappearing-timer/', SetRoomDisappearingTimerView.as_view(), name='chat_room_disappearing_timer'),

    # Message Actions
    path('messages/<uuid:message_id>/edit/', EditMessageView.as_view(), name='chat_message_edit'),
    path('messages/<uuid:message_id>/react/', MessageReactionView.as_view(), name='chat_message_react'),
    path('messages/<uuid:message_id>/open-view-once/', OpenViewOnceMessageView.as_view(), name='chat_message_open_view_once'),
    path('messages/<uuid:message_id>/', DeleteMessageView.as_view(), name='chat_message_delete'),
    path('messages/bulk-delete/', DeleteMessageView.as_view(), name='chat_message_bulk_delete'),
    path('rooms/<uuid:room_id>/mark-read/', MarkRoomReadView.as_view(), name='chat_room_mark_read'),

    # Expenses & Media
    path('expenses/<uuid:split_id>/settle/', SettleExpenseSplitView.as_view(), name='expense_settle'),
    path('rooms/<uuid:room_id>/expenses/summary/', RoomExpenseSummaryView.as_view(), name='room_expenses_summary'),
    path('upload/', MediaUploadView.as_view(), name='chat_media_upload'),

    # E2EE Key Exchange
    path('e2ee/keys/', E2EEKeyView.as_view(), name='e2ee_keys_self'),
    path('users/<uuid:user_id>/e2ee-key/', E2EEKeyView.as_view(), name='e2ee_keys_user'),
]
