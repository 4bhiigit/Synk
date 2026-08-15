from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_online', 'last_seen', 'is_staff')
    list_filter = ('is_online', 'is_staff', 'is_superuser', 'is_active')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Custom Profile', {'fields': ('avatar_url', 'is_online', 'last_seen')}),
    )
    readonly_fields = ('last_seen',)
