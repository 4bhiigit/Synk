from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from .models import ChatRoom, Message, Expense, ExpenseSplit

User = get_user_model()


class ChatAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='password123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='password123'
        )
        self.client.force_authenticate(user=self.user1)

    def test_user_search(self):
        res = self.client.get('/api/chat/users/?search=user2')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['username'], 'user2')

    def test_create_and_get_room(self):
        # 1. Create Room
        res = self.client.post('/api/chat/rooms/get-or-create/', {
            'target_user_id': str(self.user2.id)
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        room_id = res.data['id']

        # 2. Get existing room
        res2 = self.client.post('/api/chat/rooms/get-or-create/', {
            'target_user_id': str(self.user2.id)
        })
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['id'], room_id)

        # 3. List active rooms
        res3 = self.client.get('/api/chat/rooms/')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        results = res3.data.get('results', res3.data)
        self.assertEqual(len(results), 1)

    def test_expense_settle_and_summary(self):
        room = ChatRoom.objects.create(name='Trip Group', is_group=True)
        room.members.add(self.user1, self.user2)

        expense = Expense.objects.create(
            room=room,
            created_by=self.user1,
            total_amount=Decimal('100.00'),
            description='Dinner Buffet'
        )
        split1 = ExpenseSplit.objects.create(
            expense=expense,
            user=self.user1,
            amount_owed=Decimal('50.00'),
            is_settled=True
        )
        split2 = ExpenseSplit.objects.create(
            expense=expense,
            user=self.user2,
            amount_owed=Decimal('50.00'),
            is_settled=False
        )

        # Settle split2
        settle_res = self.client.patch(f'/api/chat/expenses/{split2.id}/settle/')
        self.assertEqual(settle_res.status_code, status.HTTP_200_OK)
        split2.refresh_from_db()
        self.assertTrue(split2.is_settled)

        # Get room summary
        summary_res = self.client.get(f'/api/chat/rooms/{room.id}/expenses/summary/')
        self.assertEqual(summary_res.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_res.data['total_spent'], 100.0)
