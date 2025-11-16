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

## Auth API (Supabase-backed)

The API routes use Supabase as the persistence layer. Provide the following environment variables (for example inside `.env.local`):

```
SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> ⚠️ Use the **service role key** on the server only. Never expose it to the browser.

Create a table named `app_users` (or adjust `USERS_TABLE` in `src/lib/users.js`) with at least:

```sql
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now()
);
```

### Create account

- **Endpoint:** `POST /api/auth/register`
- **Body:** `{ "name": "Jane Doe", "email": "jane@example.com", "password": "supersecret" }`
- **Response:** `201` with `{ "user": { "id": "...", "name": "...", "email": "...", "createdAt": "..." } }`

### Login

- **Endpoint:** `POST /api/auth/login`
- **Body:** `{ "email": "jane@example.com", "password": "supersecret" }`
- **Response:** `200` with `{ "user": { ... }, "sessionToken": "<uuid>" }`

Passwords are hashed with `scrypt` and compared with `timingSafeEqual` before returning sanitized user data.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
