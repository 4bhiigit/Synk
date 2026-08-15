import json
import re
import uuid
from decimal import Decimal, InvalidOperation
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
from .models import ChatRoom, Message, Expense, ExpenseSplit, MessageReaction
from .serializers import ExpenseSerializer

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Real-time WebSocket consumer supporting:
    - Instant messaging, typing indicators, read receipts, quoted replies
    - Emoji Reactions (message_reaction with live aggregate counts)
    - View Once media & Disappearing Messages timer
    - Message editing (15-min window) and deletion (for_me vs for_everyone)
    - Time-Capsule & Future Reveal Messages (Server-side timestamp verification & broadcast)
    - Synchronized In-Chat Music Player (music_change_track, music_sync_action, music_queue_update)
    - WebRTC Direct P2P Screen Sharing (screenshare_offer, screenshare_answer, screenshare_ice_candidate, screenshare_status)
    - WebRTC P2P direct large file transfer signaling (offer, answer, ICE candidates)
    - Slash command expense splitting (/split & /expense)
    - Multiplayer in-chat Tic-Tac-Toe (/game tictactoe)
    - Watch Together YouTube synchronization (video_load, video_sync, state request/response)
    - Real-time collaborative whiteboard streaming (canvas_draw, canvas_clear)
    """

    async def connect(self):
        self.user = self.scope.get('user')
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        is_member = await self.check_room_membership(self.room_id, self.user)
        if not is_member:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        await self.set_user_online_status(self.user, is_online=True)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_user_status_handler',
                'data': {
                    'type': 'user_status',
                    'user_id': str(self.user.id),
                    'username': self.user.username,
                    'is_online': True,
                }
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            if hasattr(self, 'user') and self.user.is_authenticated:
                # If user disconnects while screen sharing, broadcast stop status
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_screenshare_handler',
                        'sender_channel_name': self.channel_name,
                        'data': {
                            'type': 'screenshare_status',
                            'is_sharing': False,
                            'sharer_id': str(self.user.id),
                            'sharer_name': self.user.username,
                        }
                    }
                )

                await self.set_user_online_status(self.user, is_online=False)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_user_status_handler',
                        'data': {
                            'type': 'user_status',
                            'user_id': str(self.user.id),
                            'username': self.user.username,
                            'is_online': False,
                        }
                    }
                )

            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            return

        event_type = payload.get('type')

        # 0. Heartbeat Ping / Pong
        if event_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
            return

        # 1. WebRTC Screen Sharing Signaling
        if event_type in ['screenshare_offer', 'screenshare_answer', 'screenshare_ice_candidate', 'screenshare_status', 'screenshare_ping']:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_screenshare_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        **payload,
                        'sender_id': str(self.user.id),
                        'sender_name': self.user.username,
                    }
                }
            )
            return

        # 2. Synchronized Music Player Events
        elif event_type == 'music_change_track':
            track = payload.get('track')
            if track:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_music_handler',
                        'sender_channel_name': self.channel_name,
                        'data': {
                            'type': 'music_change_track',
                            'track': track,
                            'sender_id': str(self.user.id),
                            'sender_name': self.user.username,
                            'timestamp': 0.0,
                            'status': 'PLAYING',
                        }
                    }
                )
            return

        elif event_type == 'music_sync_action':
            action = payload.get('action')
            current_time = payload.get('current_time', 0.0)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_music_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        'type': 'music_sync_action',
                        'action': action,
                        'current_time': current_time,
                        'sender_id': str(self.user.id),
                        'sender_name': self.user.username,
                    }
                }
            )
            return

        elif event_type == 'music_queue_update':
            queue = payload.get('queue', [])
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_music_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        'type': 'music_queue_update',
                        'queue': queue,
                        'sender_id': str(self.user.id),
                    }
                }
            )
            return

        # 3. Time Capsule Creation
        elif event_type == 'create_capsule':
            content = payload.get('content', '').strip()
            media_url = payload.get('media_url')
            unlock_at_str = payload.get('unlock_at')
            capsule_title = payload.get('capsule_title', 'Time Capsule')

            if unlock_at_str:
                capsule_data = await self.save_time_capsule(
                    room_id=self.room_id,
                    sender=self.user,
                    content=content,
                    media_url=media_url,
                    unlock_at_str=unlock_at_str,
                    capsule_title=capsule_title
                )

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_capsule_create_handler',
                        'sender_id': str(self.user.id),
                        'data': {
                            'type': 'message',
                            'message': capsule_data,
                        }
                    }
                )
                return

        # 4. Time Capsule Unlock Request
        elif event_type == 'unlock_capsule_request':
            message_id = payload.get('message_id')
            if message_id:
                unlocked_res = await self.verify_and_unlock_capsule(message_id)
                if unlocked_res:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'chat_capsule_unlocked_handler',
                            'data': {
                                'type': 'capsule_unlocked',
                                **unlocked_res,
                            }
                        }
                    )
            return

        # 5. Emoji Reactions (WhatsApp / Telegram style)
        elif event_type == 'message_reaction':
            message_id = payload.get('message_id')
            emoji = payload.get('emoji', '').strip()
            if message_id and emoji:
                reactions_data = await self.toggle_message_reaction(message_id, self.user, emoji)
                if reactions_data is not None:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'chat_reaction_handler',
                            'data': {
                                'type': 'message_reaction_update',
                                'message_id': str(message_id),
                                'reactions': reactions_data,
                                'user_id': str(self.user.id),
                                'username': self.user.username,
                            }
                        }
                    )
            return

        # 6. View Once Opened Broadcast
        elif event_type == 'view_once_opened':
            message_id = payload.get('message_id')
            if message_id:
                success = await self.mark_view_once_opened(message_id, self.user)
                if success:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'chat_view_once_opened_handler',
                            'data': {
                                'type': 'view_once_opened',
                                'message_id': str(message_id),
                                'user_id': str(self.user.id),
                                'username': self.user.username,
                            }
                        }
                    )
            return

        # 7. Disappearing Timer Update
        elif event_type == 'disappearing_timer_update':
            timer_seconds = int(payload.get('disappearing_timer', 0))
            await self.update_room_disappearing_timer(self.room_id, timer_seconds)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_disappearing_timer_handler',
                    'data': {
                        'type': 'disappearing_timer_update',
                        'disappearing_timer': timer_seconds,
                        'user_id': str(self.user.id),
                        'username': self.user.username,
                    }
                }
            )
            return

        # 8. Normal Message, Quoted Replies, GIFs, View Once, or Slash Commands
        elif event_type == 'message':
            content = payload.get('content', '').strip()
            media_url = payload.get('media_url')
            reply_to_id = payload.get('reply_to_id')
            message_type = payload.get('message_type', 'text')
            is_view_once = payload.get('is_view_once', False)

            if not content and not media_url and message_type == 'text':
                return

            # Check for /split or /expense slash command
            split_match = re.match(r'^/(?:split|expense)\s+(\d+(?:\.\d+)?)\s*(.*)$', content, re.IGNORECASE)
            if split_match:
                amount_str = split_match.group(1)
                desc_str = split_match.group(2).strip() or "Split Bill"
                try:
                    total_amount = Decimal(amount_str)
                    if total_amount > 0:
                        expense_res = await self.create_expense_split(
                            room_id=self.room_id,
                            creator=self.user,
                            total_amount=total_amount,
                            description=desc_str
                        )
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'chat_message_handler',
                                'data': {
                                    'type': 'message',
                                    'message': expense_res['message'],
                                }
                            }
                        )
                        return
                except (InvalidOperation, Exception) as e:
                    print('Expense creation error:', e)

            # Check for /game or /tictactoe slash command
            if content.lower().startswith('/game tictactoe') or content.lower() == '/tictactoe':
                game_id = f"game_{uuid.uuid4().hex[:8]}"
                game_msg = await self.save_message(
                    room_id=self.room_id,
                    sender=self.user,
                    content=f"🎮 Launched Tic-Tac-Toe Mini Game! (Session: {game_id})",
                    media_url=None,
                    message_type='game_card',
                    reply_to_id=reply_to_id
                )
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message_handler',
                        'data': {
                            'type': 'message',
                            'message': game_msg,
                        }
                    }
                )
                return

            # Save normal text / attachment / voice note / GIF / View Once
            message_data = await self.save_message(
                room_id=self.room_id,
                sender=self.user,
                content=content,
                media_url=media_url,
                message_type=message_type,
                reply_to_id=reply_to_id,
                is_view_once=is_view_once
            )

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message_handler',
                    'data': {
                        'type': 'message',
                        'message': message_data,
                    }
                }
            )

        # 9. Message Edit (Author only, 15 min window)
        elif event_type == 'message_edit':
            message_id = payload.get('message_id')
            new_content = payload.get('content', '').strip()
            if message_id and new_content:
                updated_msg = await self.edit_message(message_id, self.user, new_content)
                if updated_msg:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'chat_message_edit_handler',
                            'data': {
                                'type': 'message_edit',
                                'message_id': message_id,
                                'content': new_content,
                                'is_edited': True,
                                'edited_at': timezone.now().isoformat(),
                            }
                        }
                    )

        # 10. Message Delete (for_me vs for_everyone)
        elif event_type == 'message_delete':
            message_ids = payload.get('message_ids', [])
            message_id = payload.get('message_id')
            if message_id and not message_ids:
                message_ids = [message_id]

            delete_mode = payload.get('delete_mode', 'for_me')

            if message_ids:
                if delete_mode == 'for_everyone':
                    deleted_ids = await self.delete_messages_for_everyone(message_ids, self.user)
                    if deleted_ids:
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'chat_message_delete_handler',
                                'data': {
                                    'type': 'message_delete',
                                    'message_ids': deleted_ids,
                                    'delete_mode': 'for_everyone',
                                }
                            }
                        )
                else:
                    deleted_ids = await self.delete_messages_for_me(message_ids, self.user)
                    await self.send(text_data=json.dumps({
                        'type': 'message_delete',
                        'message_ids': deleted_ids,
                        'delete_mode': 'for_me',
                    }, cls=DjangoJSONEncoder))

        # 11. WebRTC P2P File Transfer Signaling
        elif event_type in ['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate', 'p2p_file_meta']:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_webrtc_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        **payload,
                        'sender_id': str(self.user.id),
                        'sender_username': self.user.username,
                    }
                }
            )

        # 11b. WebRTC Voice & Video Calling Signaling
        elif event_type in ['call_offer', 'call_answer', 'call_ice_candidate', 'call_reject', 'call_end']:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_call_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        **payload,
                        'sender_id': str(self.user.id),
                        'sender_username': self.user.username,
                        'sender_avatar': getattr(self.user, 'avatar_url', None),
                    }
                }
            )

        # 12. In-Chat Mini Game Moves
        elif event_type in ['game_move', 'game_reset']:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_game_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        **payload,
                        'sender_id': str(self.user.id),
                        'sender_username': self.user.username,
                    }
                }
            )

        # 13. Typing Indicators
        elif event_type == 'typing':
            is_typing = payload.get('is_typing', False)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_typing_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        'type': 'typing',
                        'user_id': str(self.user.id),
                        'username': self.user.username,
                        'is_typing': is_typing,
                    }
                }
            )

        # 14. Read Receipts
        elif event_type == 'read_receipt':
            message_id = payload.get('message_id')
            await self.mark_messages_as_read(self.room_id, self.user, message_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_read_receipt_handler',
                    'data': {
                        'type': 'read_receipt',
                        'user_id': str(self.user.id),
                        'message_id': message_id,
                    }
                }
            )

        # 15. Watch Together
        elif event_type == 'video_load':
            video_url = payload.get('video_url')
            video_id = payload.get('video_id')
            title = payload.get('title', '')
            await self.update_room_video_state(self.room_id, url=video_url, status='PLAYING', timestamp=0.0)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_video_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        'type': 'video_load',
                        'video_url': video_url,
                        'video_id': video_id,
                        'title': title,
                        'sender_id': str(self.user.id),
                        'sender_name': self.user.username,
                    }
                }
            )

        elif event_type == 'video_sync':
            action = payload.get('action')
            current_time = payload.get('current_time', 0.0)
            status = 'PLAYING' if action == 'play' else 'PAUSED'
            await self.update_room_video_state(self.room_id, status=status, timestamp=current_time)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_video_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        'type': 'video_sync',
                        'action': action,
                        'current_time': current_time,
                        'sender_id': str(self.user.id),
                        'sender_name': self.user.username,
                    }
                }
            )

        elif event_type == 'video_state_request':
            room_state = await self.get_room_video_state(self.room_id)
            if room_state and room_state.get('url'):
                await self.send(
                    text_data=json.dumps(
                        {
                            'type': 'video_load',
                            'video_url': room_state['url'],
                            'video_id': None,
                            'current_time': room_state['timestamp'],
                            'status': room_state['status'],
                        },
                        cls=DjangoJSONEncoder
                    )
                )

        # 16. Collaborative Canvas
        elif event_type == 'canvas_draw':
            strokes = payload.get('strokes')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_canvas_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        'type': 'canvas_draw',
                        'strokes': strokes,
                        'sender_id': str(self.user.id),
                    }
                }
            )

        elif event_type == 'canvas_clear':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_canvas_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        'type': 'canvas_clear',
                        'sender_id': str(self.user.id),
                    }
                }
            )

        # 17. Live Poll Votes
        elif event_type == 'poll_vote':
            poll_id = payload.get('poll_id')
            option_id = payload.get('option_id')
            updated_poll = await self.save_poll_vote(poll_id, option_id, self.user)
            if updated_poll:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_poll_vote_handler',
                        'data': {
                            'type': 'poll_vote_update',
                            'poll': updated_poll,
                        }
                    }
                )

        # 18. Pin / Unpin Messages
        elif event_type == 'pin_message':
            message_id = payload.get('message_id')
            pinned_data = await self.toggle_pin_message(self.room_id, message_id, self.user)
            if pinned_data:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_pinned_message_handler',
                        'data': {
                            'type': 'pinned_message_update',
                            **pinned_data,
                        }
                    }
                )

        # 19. Watch Party Video Load
        elif event_type == 'video_load':
            video_url = payload.get('video_url')
            video_id = payload.get('video_id')
            title = payload.get('title', 'YouTube Video')
            if video_id:
                await self.update_room_active_video(self.room_id, video_url)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_video_load_handler',
                        'sender_channel_name': self.channel_name,
                        'data': {
                            'type': 'video_load',
                            'video_url': video_url,
                            'video_id': video_id,
                            'title': title,
                            'sender_id': str(self.user.id),
                            'sender_name': self.user.username,
                        }
                    }
                )

        # 20. Watch Party Video Sync (Play, Pause, Seek)
        elif event_type == 'video_sync':
            action = payload.get('action')
            current_time = payload.get('current_time', 0)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_video_sync_handler',
                    'sender_channel_name': self.channel_name,
                    'data': {
                        'type': 'video_sync',
                        'action': action,
                        'current_time': current_time,
                        'sender_id': str(self.user.id),
                        'sender_name': self.user.username,
                    }
                }
            )

    # Event Handlers
    async def chat_screenshare_handler(self, event):
        if event.get('sender_channel_name') != self.channel_name:
            await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_music_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_message_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_reaction_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_view_once_opened_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_disappearing_timer_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_capsule_create_handler(self, event):
        raw_msg = event['data']['message']
        is_sender = event.get('sender_id') == str(self.user.id)

        msg_payload = {**raw_msg}
        if not is_sender and raw_msg.get('is_capsule') and not raw_msg.get('is_unlocked'):
            msg_payload['content'] = raw_msg.get('locked_placeholder', "🔒 This is a locked Time Capsule.")
            msg_payload['media_url'] = None
            msg_payload['is_locked_for_me'] = True
        else:
            msg_payload['is_locked_for_me'] = False

        await self.send(text_data=json.dumps({'type': 'message', 'message': msg_payload}, cls=DjangoJSONEncoder))

    async def chat_capsule_unlocked_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_message_edit_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_message_delete_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_poll_vote_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_pinned_message_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_webrtc_handler(self, event):
        if event.get('sender_channel_name') != self.channel_name:
            await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_call_handler(self, event):
        if event.get('sender_channel_name') != self.channel_name:
            await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_game_handler(self, event):
        if event.get('sender_channel_name') != self.channel_name:
            await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_typing_handler(self, event):
        if event.get('sender_channel_name') != self.channel_name:
            await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_read_receipt_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_user_status_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_video_handler(self, event):
        if event.get('sender_channel_name') != self.channel_name:
            await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_video_load_handler(self, event):
        await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_video_sync_handler(self, event):
        if event.get('sender_channel_name') != self.channel_name:
            await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    async def chat_canvas_handler(self, event):
        if event.get('sender_channel_name') != self.channel_name:
            await self.send(text_data=json.dumps(event['data'], cls=DjangoJSONEncoder))

    # Database Operations
    @database_sync_to_async
    def update_room_active_video(self, room_id, video_url):
        try:
            ChatRoom.objects.filter(id=room_id).update(active_video_url=video_url)
        except Exception:
            pass

    @database_sync_to_async
    def check_room_membership(self, room_id, user):
        try:
            room = ChatRoom.objects.get(id=room_id)
            if getattr(room, 'is_public', False):
                return True
            return room.members.filter(id=user.id).exists()
        except (ChatRoom.DoesNotExist, ValueError, Exception):
            return False

    @database_sync_to_async
    def save_message(self, room_id, sender, content, media_url=None, message_type='text', reply_to_id=None, is_view_once=False, extra_data=None):
        room = ChatRoom.objects.get(id=room_id)
        reply_to_msg = None
        if reply_to_id:
            try:
                reply_to_msg = Message.objects.get(id=reply_to_id)
            except Message.DoesNotExist:
                pass

        expires_at = None
        if room.disappearing_timer and room.disappearing_timer > 0:
            expires_at = timezone.now() + timezone.timedelta(seconds=room.disappearing_timer)

        msg = Message.objects.create(
            room=room,
            sender=sender,
            content=content,
            media_url=media_url,
            message_type=message_type,
            reply_to=reply_to_msg,
            is_view_once=is_view_once,
            expires_at=expires_at
        )
        msg.read_by.add(sender)
        room.save(update_fields=['updated_at'])

        reply_to_data = None
        if reply_to_msg:
            reply_to_data = {
                'id': str(reply_to_msg.id),
                'sender_id': str(reply_to_msg.sender_id),
                'sender_username': reply_to_msg.sender.username,
                'sender_avatar': reply_to_msg.sender.avatar_url,
                'content': reply_to_msg.content,
                'media_url': reply_to_msg.media_url,
                'message_type': reply_to_msg.message_type,
            }

        return {
            'id': str(msg.id),
            'room': str(room.id),
            'sender': {
                'id': str(sender.id),
                'username': sender.username,
                'email': sender.email,
                'avatar_url': sender.avatar_url,
                'first_name': sender.first_name,
                'last_name': sender.last_name,
            },
            'content': msg.content,
            'media_url': msg.media_url,
            'message_type': msg.message_type,
            'reply_to': reply_to_data,
            'is_edited': msg.is_edited,
            'is_capsule': False,
            'is_view_once': msg.is_view_once,
            'is_view_once_opened': False,
            'expires_at': msg.expires_at.isoformat() if msg.expires_at else None,
            'deleted_for_everyone': False,
            'is_forwarded': False,
            'reactions': [],
            'delivery_status': 'sent',
            'read_by': [str(sender.id)],
            'read_by_count': 1,
            'timestamp': msg.timestamp.isoformat(),
        }

    @database_sync_to_async
    def mark_view_once_opened(self, message_id, user):
        try:
            msg = Message.objects.get(id=message_id, room_id=self.room_id, is_view_once=True)
            msg.view_once_opened_by.add(user)
            return True
        except Message.DoesNotExist:
            return False

    @database_sync_to_async
    def update_room_disappearing_timer(self, room_id, timer_seconds):
        try:
            room = ChatRoom.objects.get(id=room_id)
            room.disappearing_timer = timer_seconds
            room.save(update_fields=['disappearing_timer'])
            return True
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def toggle_message_reaction(self, message_id, user, emoji):
        try:
            msg = Message.objects.get(id=message_id, room_id=self.room_id)
            reaction = MessageReaction.objects.filter(message=msg, user=user).first()
            if reaction:
                if reaction.emoji == emoji:
                    reaction.delete()
                else:
                    reaction.emoji = emoji
                    reaction.save()
            else:
                MessageReaction.objects.create(message=msg, user=user, emoji=emoji)

            reactions_map = {}
            for r in msg.reactions.all().select_related('user'):
                e = r.emoji
                if e not in reactions_map:
                    reactions_map[e] = {
                        'emoji': e,
                        'count': 0,
                        'users': [],
                        'user_ids': [],
                    }
                reactions_map[e]['count'] += 1
                reactions_map[e]['users'].append(r.user.username)
                reactions_map[e]['user_ids'].append(str(r.user.id))

            return list(reactions_map.values())
        except Message.DoesNotExist:
            return None

    @database_sync_to_async
    def save_time_capsule(self, room_id, sender, content, media_url, unlock_at_str, capsule_title):
        room = ChatRoom.objects.get(id=room_id)

        try:
            unlock_at = datetime.fromisoformat(unlock_at_str.replace('Z', '+00:00'))
        except Exception:
            unlock_at = timezone.now() + timezone.timedelta(hours=1)

        msg = Message.objects.create(
            room=room,
            sender=sender,
            content=content,
            media_url=media_url,
            message_type='capsule_card',
            is_capsule=True,
            unlock_at=unlock_at,
            capsule_title=capsule_title or "Time Capsule",
            locked_placeholder="🔒 This is a locked Time Capsule."
        )
        msg.read_by.add(sender)
        room.save(update_fields=['updated_at'])

        return {
            'id': str(msg.id),
            'room': str(room.id),
            'sender': {
                'id': str(sender.id),
                'username': sender.username,
                'avatar_url': sender.avatar_url,
                'first_name': sender.first_name,
                'last_name': sender.last_name,
            },
            'content': msg.content,
            'media_url': msg.media_url,
            'message_type': 'capsule_card',
            'is_capsule': True,
            'unlock_at': msg.unlock_at.isoformat(),
            'is_unlocked': False,
            'capsule_title': msg.capsule_title,
            'locked_placeholder': msg.locked_placeholder,
            'deleted_for_everyone': False,
            'is_view_once': False,
            'reactions': [],
            'read_by': [str(sender.id)],
            'read_by_count': 1,
            'timestamp': msg.timestamp.isoformat(),
        }

    @database_sync_to_async
    def verify_and_unlock_capsule(self, message_id):
        try:
            msg = Message.objects.get(id=message_id, is_capsule=True)
            if msg.unlock_at and timezone.now() >= msg.unlock_at:
                msg.is_unlocked = True
                msg.save(update_fields=['is_unlocked'])
                return {
                    'message_id': str(msg.id),
                    'content': msg.content,
                    'media_url': msg.media_url,
                    'capsule_title': msg.capsule_title,
                    'is_unlocked': True,
                    'unlock_at': msg.unlock_at.isoformat(),
                }
            return None
        except Message.DoesNotExist:
            return None

    @database_sync_to_async
    def edit_message(self, message_id, user, new_content):
        try:
            msg = Message.objects.get(id=message_id, sender=user)
            if msg.deleted_for_everyone:
                return None
            time_diff = (timezone.now() - msg.timestamp).total_seconds()
            if time_diff > 900:
                return None
            msg.content = new_content
            msg.is_edited = True
            msg.edited_at = timezone.now()
            msg.save()
            return msg
        except Message.DoesNotExist:
            return None

    @database_sync_to_async
    def delete_messages_for_everyone(self, message_ids, user):
        msgs = Message.objects.filter(id__in=message_ids, sender=user)
        deleted_ids = []
        for m in msgs:
            m.deleted_for_everyone = True
            m.content = "🚫 This message was deleted"
            m.media_url = None
            m.save()
            deleted_ids.append(str(m.id))
        return deleted_ids

    @database_sync_to_async
    def delete_messages_for_me(self, message_ids, user):
        msgs = Message.objects.filter(id__in=message_ids)
        deleted_ids = []
        for m in msgs:
            m.deleted_by_users.add(user)
            deleted_ids.append(str(m.id))
        return deleted_ids

    @database_sync_to_async
    def create_expense_split(self, room_id, creator, total_amount, description):
        room = ChatRoom.objects.get(id=room_id)
        members = list(room.members.all())
        members_count = len(members) or 1
        per_person = round(total_amount / Decimal(members_count), 2)

        expense = Expense.objects.create(
            room=room,
            created_by=creator,
            total_amount=total_amount,
            description=description
        )

        for member in members:
            is_creator = member.id == creator.id
            ExpenseSplit.objects.create(
                expense=expense,
                user=member,
                amount_owed=per_person,
                is_settled=is_creator,
                settled_at=timezone.now() if is_creator else None
            )

        content = f"💳 Split Bill: {description} - Total: ${total_amount:,.2f} (${per_person:,.2f} each)"
        msg = Message.objects.create(
            room=room,
            sender=creator,
            content=content,
            message_type='expense_card'
        )
        msg.read_by.add(creator)
        room.save(update_fields=['updated_at'])

        expense_data = ExpenseSerializer(expense).data

        return {
            'message': {
                'id': str(msg.id),
                'room': str(room.id),
                'sender': {
                    'id': str(creator.id),
                    'username': creator.username,
                    'avatar_url': creator.avatar_url,
                    'first_name': creator.first_name,
                    'last_name': creator.last_name,
                },
                'content': msg.content,
                'message_type': 'expense_card',
                'expense_data': expense_data,
                'deleted_for_everyone': False,
                'is_view_once': False,
                'reactions': [],
                'read_by': [str(creator.id)],
                'read_by_count': 1,
                'timestamp': msg.timestamp.isoformat(),
            }
        }

    @database_sync_to_async
    def update_room_video_state(self, room_id, url=None, status=None, timestamp=None):
        try:
            room = ChatRoom.objects.get(id=room_id)
            if url is not None:
                room.active_video_url = url
            if status is not None:
                room.video_status = status
            if timestamp is not None:
                room.last_timestamp = timestamp
            room.save()
        except ChatRoom.DoesNotExist:
            pass

    @database_sync_to_async
    def get_room_video_state(self, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id)
            return {
                'url': room.active_video_url,
                'status': room.video_status,
                'timestamp': room.last_timestamp,
            }
        except ChatRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def mark_messages_as_read(self, room_id, user, message_id=None):
        try:
            room = ChatRoom.objects.get(id=room_id)
            if message_id:
                msgs = room.messages.filter(id=message_id)
            else:
                msgs = room.messages.exclude(read_by=user)
            for m in msgs:
                m.read_by.add(user)
        except Exception:
            pass

    @database_sync_to_async
    def set_user_online_status(self, user, is_online):
        try:
            u = User.objects.get(id=user.id)
            u.is_online = is_online
            u.last_seen = timezone.now()
            u.save(update_fields=['is_online', 'last_seen'])
        except User.DoesNotExist:
            pass

    @database_sync_to_async
    def save_poll_vote(self, poll_id, option_id, user):
        try:
            from .models import Poll, PollOption, PollVote
            from .serializers import PollSerializer

            poll = Poll.objects.get(id=poll_id)
            if poll.is_closed:
                return None
            option = PollOption.objects.get(id=option_id, poll=poll)
            existing = PollVote.objects.filter(poll=poll, option=option, user=user).first()
            if existing:
                existing.delete()
            else:
                if not poll.is_multiple_choice:
                    PollVote.objects.filter(poll=poll, user=user).delete()
                PollVote.objects.create(poll=poll, option=option, user=user)

            return PollSerializer(poll).data
        except Exception:
            return None

    @database_sync_to_async
    def toggle_pin_message(self, room_id, message_id, user):
        try:
            from .models import ChatRoom, Message
            from .serializers import PinnedMessageSerializer

            room = ChatRoom.objects.get(id=room_id)
            msg = Message.objects.get(id=message_id, room=room)
            if room.pinned_messages.filter(id=msg.id).exists():
                room.pinned_messages.remove(msg)
                action = 'unpinned'
            else:
                room.pinned_messages.add(msg)
                action = 'pinned'

            pinned = PinnedMessageSerializer(room.pinned_messages.all(), many=True).data
            return {
                'action': action,
                'message_id': str(msg.id),
                'pinned_messages': pinned,
            }
        except Exception:
            return None
