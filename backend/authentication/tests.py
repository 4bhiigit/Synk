from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class AuthenticationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_user_registration_and_login(self):
        # 1. Test Registration
        register_payload = {
            'username': 'john_doe',
            'email': 'john@example.com',
            'first_name': 'John',
            'last_name': 'Doe',
            'password': 'password123',
            'password_confirm': 'password123',
        }
        res = self.client.post('/api/auth/register/', register_payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', res.data)
        self.assertIn('access', res.data['tokens'])

        # 2. Test Login with email
        login_payload = {
            'username_or_email': 'john@example.com',
            'password': 'password123',
        }
        login_res = self.client.post('/api/auth/login/', login_payload)
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        access_token = login_res.data['tokens']['access']

        # 3. Test Profile Endpoint (/api/auth/me/)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_res = self.client.get('/api/auth/me/')
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertEqual(me_res.data['username'], 'john_doe')
        self.assertEqual(me_res.data['email'], 'john@example.com')
