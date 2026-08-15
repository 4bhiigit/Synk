# 🚀 100% Free Production Deployment Guide

A complete, battle-tested blueprint to host the **Nexus Real-Time Chat Application** for **100% free** with real-time WebSockets, persistent PostgreSQL, serverless Redis channel layers, and global CDN frontend delivery.

---

## Architecture Overview

```
                        ┌──────────────────────────────┐
                        │   Vercel / Netlify (Frontend)│
                        │    React (Vite) + Tailwind   │
                        └──────────────┬───────────────┘
                                       │ HTTPS / WSS
                                       ▼
                        ┌──────────────────────────────┐
                        │    Render.com (Web Service)  │
                        │  Django 5 + Daphne ASGI      │
                        │  (Channels WebSocket Engine) │
                        └───────┬──────────────┬───────┘
                                │              │
                   PostgreSQL   │              │ Redis Channel Layer
                                ▼              ▼
                 ┌────────────────────┐   ┌───────────────────────┐
                 │ Neon.tech/Supabase │   │  Upstash Redis Cloud  │
                 │ Free PostgreSQL DB │   │  Free Serverless Redis│
                 └────────────────────┘   └───────────────────────┘
```

---

## Step 1: Free PostgreSQL Database (Neon.tech or Supabase)

### Option A: Neon.tech (Recommended - Instant Serverless Postgres)
1. Sign up at [https://neon.tech](https://neon.tech) (Free tier includes 0.5 GB storage, autoscaling).
2. Click **Create Project** -> Name it `nexus-chat-db`.
3. In the Dashboard, copy the **Connection string** (select `Postgres` or `Direct connection`).
4. Format:
   ```text
   postgres://alex:secret_password@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/nexus_db?sslmode=require
   ```

### Option B: Supabase
1. Sign up at [https://supabase.com](https://supabase.com) (Free tier includes 500 MB DB).
2. Create a new project -> Choose a region close to your Render deployment.
3. Go to **Project Settings** -> **Database** -> Copy the **URI connection string** (under Session pooler / Direct).

---

## Step 2: Free Serverless Redis (Upstash)

Django Channels requires Redis as the channel layer to broadcast messages across WebSocket connections.

1. Sign up for free at [https://upstash.com](https://upstash.com) (Free tier provides 10,000 commands/day).
2. Click **Create Database**:
   - Name: `nexus-chat-redis`
   - Region: Select same region as your Render web service (e.g., `us-east-1` or `eu-central-1`)
   - Primary: Serverless
3. Under the database details, scroll to the **Connect** section:
   - Click the **Node / ioredis** or **Redis URL** tab.
   - Copy the `rediss://...` connection URL.
   - Example:
     ```text
     rediss://default:AX123456abc@us1-cool-panda-32123.upstash.io:6379
     ```

---

## Step 3: Backend & WebSocket Deployment on Render.com

Render natively supports ASGI servers like Daphne and real-time WebSockets over HTTPS/WSS.

1. Push your project code to a **GitHub repository**.
2. Sign up at [https://render.com](https://render.com).
3. Click **New +** -> **Web Service** -> Connect your GitHub repo.
4. Fill in the deployment settings:

| Setting | Value |
| :--- | :--- |
| **Name** | `nexus-chat-backend` |
| **Region** | Oregon (US West) or Ohio (US East) |
| **Root Directory** | `backend` |
| **Environment** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt && python manage.py migrate` |
| **Start Command** | `daphne -b 0.0.0.0 -p $PORT core.asgi:application` |
| **Instance Type** | Free |

5. Under **Environment Variables**, add the following:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `SECRET_KEY` | *(Generate a 50-character random string)* | Keep private |
| `DEBUG` | `False` | Production mode |
| `ALLOWED_HOSTS` | `*` or `your-service.onrender.com` | Host verification |
| `DATABASE_URL` | `postgres://...@neon.tech/...` | Copied from Step 1 |
| `REDIS_URL` | `rediss://default:...@upstash.io:6379` | Copied from Step 2 |
| `CORS_ALLOW_ALL_ORIGINS` | `True` | Or your Vercel URL below |
| `CORS_ALLOWED_ORIGINS` | `https://nexus-chat.vercel.app` | Your frontend URL |

6. Click **Create Web Service**.
7. Once deployed, Render will provide your public backend URL, e.g.:
   `https://nexus-chat-backend.onrender.com`

---

## Step 4: Frontend Deployment (Vercel or Netlify)

### Option A: Deploy to Vercel (Recommended)
1. Sign up at [https://vercel.com](https://vercel.com).
2. Click **Add New...** -> **Project** -> Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:

| Key | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://nexus-chat-backend.onrender.com` |
| `VITE_WS_URL` | `wss://nexus-chat-backend.onrender.com` |

> [!IMPORTANT]
> Note the `wss://` (secure WebSocket) protocol instead of `ws://` for production HTTPS!

5. Click **Deploy**. Vercel will build and assign you a fast CDN domain (e.g. `https://nexus-chat.vercel.app`).

---

### Option B: Deploy to Netlify
1. Sign up at [https://netlify.com](https://netlify.com).
2. Click **Add new site** -> **Import an existing project**.
3. Select repo, set **Base directory** to `frontend`, **Build command** to `npm run build`, and **Publish directory** to `dist`.
4. Set Environment Variables:
   - `VITE_API_URL`: `https://nexus-chat-backend.onrender.com`
   - `VITE_WS_URL`: `wss://nexus-chat-backend.onrender.com`
5. Click **Deploy Site**.

---

## Step 5: Verification & Zero-Downtime Keep-Alive Tip

### Free Tier Keep-Alive
Render's free tier spins down after 15 minutes of inactivity. To keep your chat backend awake and responsive 24/7 with zero cold starts:
1. Sign up for free at [https://cron-job.org](https://cron-job.org) or [https://uptimerobot.com](https://uptimerobot.com).
2. Add an HTTP monitor to ping your backend:
   `https://nexus-chat-backend.onrender.com/api/auth/me/`
3. Interval: **Every 10 minutes**.
4. Result: Your backend remains active with zero downtime!
