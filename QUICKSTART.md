# Quick Start Guide

Get up and running in 5 minutes!

## 1. Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Create a new project
3. Go to **Settings** → **API**
4. Copy your **Project URL** and **anon/public key**

## 2. Set Up Database

In Supabase, go to **SQL Editor** and run the SQL from `SETUP.md` (Step 2) to create tables.

## 3. Configure Backend

Create `backend/.env` file:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:5500
```

## 4. Install & Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be at: http://localhost:8000

## 5. Open Frontend

Open `frontend/index.html` in your browser, or use a simple server:

```bash
cd frontend
python -m http.server 8080
```

Then open: http://localhost:8080

## 6. Test It!

1. Register a new user
2. Login
3. Create a listing
4. Browse listings
5. Purchase a listing

**That's it!** 🎉

For detailed setup instructions, see `SETUP.md`.

