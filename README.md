# ⚡ Nexus Chat - Full-Stack Real-Time Messaging Application

A production-grade, real-time messaging application built with **Django 5**, **Django Channels (ASGI)**, **Daphne**, **SimpleJWT**, **React 18 (Vite)**, and **Tailwind CSS**. Converted for Android mobile with **Capacitor 6** and ready for 100% free cloud deployment on **Render + Vercel + Neon + Upstash**.

---

## 🌟 Key Features

- **🔐 Robust Authentication**: Custom UUID User model, JWT Authentication (access + refresh tokens), 401 auto-token refresh interceptor.
- **⚡ Real-Time WebSockets**: Django Channels `AsyncWebsocketConsumer` over ASGI with Daphne for high-concurrency instant messaging.
- **💬 Instant Messaging & History**: 1-on-1 direct messages & group chats, paginated message history, read receipts, and multimedia attachments.
- **✍️ Live Typing Indicators & Presence**: Instant live typing broadcast with 2-second debounce auto-clear and real-time online/offline indicators.
- **🎨 Modern Messenger UI**: WhatsApp/Telegram Web-inspired responsive glassmorphism interface, custom scrollbars, dark mode, and Lucide icons.
- **📱 Android APK Ready**: Capacitor 6 configuration, AndroidManifest permissions, and cleartext development support.
- **☁️ 100% Free Production Deployment**: Full blueprint for Render.com (Daphne ASGI), Neon (Serverless Postgres), Upstash (Serverless Redis), and Vercel.

---

## 📂 Project Architecture

```
Real time chat application/
├── backend/
│   ├── core/                  # Django & Daphne ASGI settings, routing & ws_urls
│   ├── authentication/        # Custom UUID User model, JWT auth views, serializers
│   ├── chat/                  # ChatRoom, Message models, REST endpoints, AsyncWebsocketConsumer, JWT WS Middleware
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/               # Axios instance with auto JWT attach & 401 refresh queue
│   │   ├── components/        # Sidebar, ChatArea, MessageInput, UserSearchModal, Avatar, Loader
│   │   ├── context/           # AuthContext (global state & user session)
│   │   ├── hooks/             # useChatSocket (auto-reconnect, message state, typing debounce)
│   │   ├── pages/             # AuthPage (Login/Register) & DashboardPage (2-column layout)
│   │   └── index.css          # Tailwind directives, glassmorphism, animations
│   ├── capacitor.config.ts    # Capacitor mobile settings
│   └── package.json
└── docs/
    ├── CAPACITOR_ANDROID_GUIDE.md # Android APK conversion & AndroidManifest guide
    └── DEPLOYMENT_GUIDE.md        # Free deployment blueprint (Neon, Upstash, Render, Vercel)
```

---

## 🚀 Quickstart: Running Locally

### 1. Start the Backend (Daphne ASGI + Django)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (optional) & install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py makemigrations authentication chat
python manage.py migrate

# Start Daphne ASGI Server (supports HTTP + WebSockets simultaneously)
daphne -b 127.0.0.1 -p 8000 core.asgi:application
```

> The backend will be live on `http://127.0.0.1:8000` (HTTP) and `ws://127.0.0.1:8000/ws/chat/<room_id>/` (WebSocket).

---

### 2. Start the Frontend (React + Vite)

```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev
```

> Open your browser at `http://localhost:5173`.

---

## 🧪 REST API Endpoints Summary

### Authentication (`/api/auth/`)
- `POST /api/auth/register/` - Register new user and return JWT tokens.
- `POST /api/auth/login/` - Login with username/email and password.
- `GET /api/auth/me/` - Retrieve current user profile.
- `PATCH /api/auth/me/` - Update profile details (avatar, name, etc.).
- `POST /api/auth/token/refresh/` - Refresh expired access token.

### Chat & Messaging (`/api/chat/`)
- `GET /api/chat/users/?search=<query>` - Search registered users to start a chat.
- `POST /api/chat/rooms/get-or-create/` - Create or fetch existing 1-on-1 chat room.
- `GET /api/chat/rooms/` - List user's active conversations with unread badges & last message snippet.
- `GET /api/chat/rooms/<room_id>/messages/?page=1` - Paginated message history (20 per page).
- `POST /api/chat/rooms/<room_id>/mark-read/` - Mark all messages in room as read.

### WebSocket (`ws://<host>/ws/chat/<room_id>/?token=<jwt_access_token>`)
- **Incoming / Outgoing Events**:
  - `{"type": "message", "content": "Hello!", "media_url": null}`
  - `{"type": "typing", "is_typing": true}`
  - `{"type": "read_receipt", "message_id": "<uuid>"}`

---

## 📱 Mobile APK Conversion & Free Deployment Guides
- **[Capacitor Android APK Guide](docs/CAPACITOR_ANDROID_GUIDE.md)**: Full walkthrough for building debug/release APKs via Android Studio or Gradle CLI.
- **[Free Production Deployment Blueprint](docs/DEPLOYMENT_GUIDE.md)**: Zero-cost step-by-step hosting on Neon.tech (PostgreSQL), Upstash (Redis), Render.com (Daphne ASGI WebSockets), and Vercel (React Frontend).
