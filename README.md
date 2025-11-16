This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Auth API (Supabase Auth)

The API routes call Supabase Auth directly—no custom password hashing or tables are required. Set these variables in `.env.local`:

```
SUPABASE_URL=<your-project-url>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> ⚠️ The service role key must only be used on the server (API routes, middleware, edge functions). Never expose it to the browser.

### Create account

- **Endpoint:** `POST /api/auth/register`
- **Body:**
  ```json
  {
    "firstName": "Jane",
    "lastName": "Doe",
    "username": "jdoe",
    "email": "jane@example.com",
    "phone": "+12065550123",
    "password": "supersecret"
  }
  ```
- **Response:** `201` with `{ "user": { "id": "...", "email": "...", "name": "...", ... } }`
  - `phone` must be supplied in international [E.164 format](https://www.twilio.com/docs/glossary/what-e164) (leading `+` and digits only). Omit the field if you do not want to collect a phone number yet.

### Login

- **Endpoint:** `POST /api/auth/login`
- **Body:** `{ "email": "jane@example.com", "password": "supersecret" }`
- **Response:** `200` with `{ "user": { ... }, "session": { "accessToken": "...", "refreshToken": "...", "expiresAt": 123 } }`

Return values mirror Supabase Auth responses, so you can forward the session tokens to the client or exchange them for cookies depending on your app’s needs.

## Items API

A simple `items` table in Supabase (columns: `id uuid default gen_random_uuid() primary key, seller_id uuid not null, type text not null default 'inventory', name text not null, expiry_date date, date_of_purchase date, price numeric, quantity integer not null default 0, image_path text, created_at timestamptz default now(), updated_at timestamptz default now()`) powers the item upload endpoint.

- **Endpoint:** `POST /api/items`
- **Body:**
  ```json
  {
    "sellerId": "00000000-0000-0000-0000-000000000000",
    "type": "inventory",
    "name": "Cherry Tomatoes",
    "expiryDate": "2025-12-01",
    "dateOfPurchase": "2025-11-15",
    "price": 4.99,
    "quantity": 3,
    "imagePath": "https://public-bucket.example.com/tomatoes.jpg"
  }
  ```
- **Response:** `201` with `{ "item": { "id": "...", "sellerId": "...", "name": "...", ... } }`

`type` defaults to `inventory` if omitted, and `quantity` must be a non-negative integer. Dates should be ISO-8601 strings (e.g. `YYYY-MM-DD`). Use your Supabase `seller_id` (often the Supabase Auth user ID) to associate items with a user.

### AI enrichment (Gemini)

Add the Gemini environment variables as well:

```
GEMINI_API_KEY=<google-ai-studio-key>
GEMINI_MODEL=gemini-1.5-flash   # optional override
```

The `/api/items/enrich` route uses Gemini to suggest a name and expiry date from an image. Provide either the `itemId` (it will read `image_path` from Supabase) or a direct `imageUrl` if you just want the AI response.

- **Endpoint:** `POST /api/items/enrich`
- **Body:**
  ```json
  {
    "itemId": "00000000-0000-0000-0000-000000000000",
    "imageUrl": "https://public-bucket.example.com/tomatoes.jpg"
  }
  ```
- **Response:**
  ```json
  {
    "ai": {
      "name": "Cherry Tomatoes",
      "expiryDate": "2025-12-05",
      "confidence": 0.72,
      "notes": "Expiration date read from the printed label.",
      "raw": { "...": "..." }
    },
    "item": {
      "id": "...",
      "name": "Cherry Tomatoes",
      "expiryDate": "2025-12-05",
      "...": "..."
    }
  }
  ```

When an `itemId` is supplied, the backend updates that row with any non-null AI suggestion. If you rely on Supabase Storage, generate a signed URL before calling this endpoint so Gemini can access the file.

> ℹ️ When `itemId` is provided, the enrichment route also sends the stored `date_of_purchase` to Gemini so it can estimate an expiry date relative to when the item was bought.

### Purchase/Buy Items

When a buyer wants to purchase an item from a seller, the system automatically sends an email notification to the seller.

Add the Resend environment variables:

```
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL=<your-verified-email@yourdomain.com>
```

> ⚠️ You need to verify your sender email address in Resend before sending emails. For development, you can use `onboarding@resend.dev` as the default sender.

- **Endpoint:** `POST /api/items/buy`
- **Body:**
  ```json
  {
    "itemId": "00000000-0000-0000-0000-000000000000",
    "buyerId": "11111111-1111-1111-1111-111111111111"
  }
  ```
- **Response:** `200` with:
  ```json
  {
    "success": true,
    "message": "Purchase request sent successfully. The seller has been notified.",
    "item": {
      "id": "...",
      "name": "Cherry Tomatoes",
      "price": 4.99,
      "quantity": 3
    },
    "seller": {
      "id": "...",
      "name": "John Doe",
      "email": "seller@example.com"
    },
    "buyer": {
      "id": "...",
      "name": "Jane Smith",
      "email": "buyer@example.com"
    }
  }
  ```

The seller will receive an email notification containing:
- Item details (name, price, quantity)
- Buyer information (name, email)
- Instructions to contact the buyer

> ⚠️ Users cannot purchase their own items. The API will return an error if `buyerId` matches the item's `sellerId`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
