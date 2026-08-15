from django.contrib import admin
from .models import ChatRoom, Message


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'is_group', 'created_at', 'updated_at')
    list_filter = ('is_group', 'created_at')
    search_fields = ('name', 'members__username', 'members__email')
    filter_horizontal = ('members',)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'sender', 'content_snippet', 'timestamp')
    list_filter = ('timestamp', 'room')
    search_fields = ('content', 'sender__username', 'sender__email')

    def content_snippet(self, obj):
        return obj.content[:50]
    content_snippet.short_description = 'Content'
