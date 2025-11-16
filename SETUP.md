# Local Development Setup Guide

This guide will help you set up and run the Save My Foods application on localhost.

## Prerequisites

- Python 3.8+ installed
- Supabase account (free tier works)
- Node.js (optional, for frontend if using a dev server)

## Step 1: Set Up Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. Once your project is created, go to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 2: Create Database Tables

In your Supabase project, go to **SQL Editor** and run the following SQL to create the necessary tables:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    profile_picture TEXT,
    phone_number TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create listings table
CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    image_url TEXT NOT NULL,
    location TEXT,
    expires_on DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to decrement inventory
CREATE OR REPLACE FUNCTION decrement_inventory(
    listing_id_input INTEGER,
    quantity_input INTEGER
)
RETURNS TABLE(id INTEGER, quantity INTEGER) AS $$
BEGIN
    RETURN QUERY
    UPDATE listings
    SET quantity = listings.quantity - quantity_input
    WHERE listings.id = listing_id_input
      AND listings.quantity >= quantity_input
    RETURNING listings.id, listings.quantity;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust as needed for your use case)
-- For development, you might want to allow all operations
-- In production, create more restrictive policies

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Listings policies
CREATE POLICY "Anyone can view listings" ON listings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create listings" ON listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update their own listings" ON listings FOR UPDATE USING (auth.uid() = seller_id);

-- Purchases policies
CREATE POLICY "Users can view purchases" ON purchases FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create purchases" ON purchases FOR INSERT WITH CHECK (auth.uid() = buyer_id);
```

## Step 3: Configure Environment Variables

Create a `.env` file in the `backend/` directory with the following content:

```env
# TODO: Add your Supabase project URL
# Get this from your Supabase project settings: https://app.supabase.com/project/_/settings/api
SUPABASE_URL=https://your-project-id.supabase.co

# TODO: Add your Supabase anonymous/public key
# Get this from your Supabase project settings: https://app.supabase.com/project/_/settings/api
SUPABASE_ANON_KEY=your-anon-key-here

# TODO: Add your Supabase service role key (optional, for admin operations)
# Get this from your Supabase project settings: https://app.supabase.com/project/_/settings/api
# WARNING: Keep this secret! Never expose this in client-side code.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# TODO: Add allowed origins for CORS (comma-separated)
# For localhost development, use: http://localhost:3000,http://localhost:8080,http://127.0.0.1:5500
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://127.0.0.1:5500

# TODO: Add AI expiry estimation endpoint (optional)
# This is for the AI estimator service that predicts food expiry dates
AI_EXPIRY_ENDPOINT=http://localhost:8100/estimate

# TODO: Add AI expiry API key (optional)
# API key for authenticating with the AI estimator service
AI_EXPIRY_API_KEY=your-ai-api-key-here
```

**Important:** Replace all the `TODO` values with your actual Supabase credentials.

## Step 4: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Or if you're using a virtual environment (recommended):

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Step 5: Run the Backend Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

You can also check the API documentation at `http://localhost:8000/docs`

## Step 6: Open the Frontend

1. Open `frontend/index.html` in your web browser
   - You can use a simple HTTP server like Python's built-in server:
     ```bash
     cd frontend
     python -m http.server 8080
     ```
   - Then open `http://localhost:8080` in your browser

2. Or use VS Code's Live Server extension, or any other static file server

3. In the frontend, configure the API URL (default is `http://localhost:8000`)

## Step 7: Test the Application

1. **Register a new user:**
   - Fill in all the registration fields
   - Click "Register"
   - You should receive an access token

2. **Login:**
   - Use the email and password you registered with
   - Click "Login"
   - You should see your authentication token

3. **Create a listing:**
   - Switch to the "Create Listing" tab
   - Fill in the listing details
   - Click "Create Listing"
   - The listing should be created and linked to your user account

4. **Browse listings:**
   - Switch to the "Listings" tab
   - Click "Refresh Listings"
   - You should see all available listings

5. **Purchase a listing:**
   - While logged in, click "Purchase" on any listing
   - Enter the quantity you want to purchase
   - The purchase should be recorded

## Troubleshooting

### CORS Errors
If you see CORS errors in the browser console, make sure:
- Your `ALLOWED_ORIGINS` in `.env` includes the URL you're accessing the frontend from
- The backend server is running
- You've restarted the backend after changing `.env`

### Authentication Errors
- Make sure your Supabase credentials are correct in `.env`
- Check that the Supabase project is active
- Verify that the database tables were created successfully

### Database Errors
- Ensure you've run all the SQL commands in Step 2
- Check that Row Level Security policies are set up correctly
- Verify that foreign key relationships are correct

## API Endpoints

- `GET /health` - Health check
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login with email/password
- `GET /listings/` - Get all listings (no auth required)
- `POST /listings/` - Create a new listing (auth required)
- `POST /listings/{id}/purchase` - Purchase a listing (auth required)

## Next Steps

- Set up the AI estimator service (optional)
- Configure production environment variables
- Set up proper error handling and logging
- Add more features as needed

