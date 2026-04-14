# Flight-SMS Booking Assistant

A cloud-hosted automated agent that texts you flight options at your configured, preferred schedule. 

## Tech Stack
- **Next.js (App Router)**: Fast, premium dashboard and serverless API endpoints.
- **Supabase (PostgreSQL)**: Permanent database storage for conversations and schedules.
- **Prisma ORM**: Type-safe interactions with your database.
- **Twilio SMS**: Handles text-messaging fallback/agent responses.
- **Tequila by Kiwi**: Free flight-search provider for generating options and booking URLs.

## Requirements

Before starting, acquire keys for the following free/cheap services:
1. **[Supabase](https://supabase.com)**: Create a new project and copy the Transaction / Pooler Database URLs.
2. **[Twilio](https://twilio.com)**: Buy a cheap number ($1/mo) and copy the `ACCOUNT_SID` and `AUTH_TOKEN`.
3. **[Tequila](https://tequila.kiwi.com)**: Sign up and create a server API key for free flight searches.

## Setup Steps

1. Copy `.env.example` to `.env` and fill out your keys.
   ```bash
   cp .env.example .env
   ```

2. Format Prisma and push the schema to your Supabase instance:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

3. **Install Dependencies & Start Locally**
   ```bash
   npm install
   npm run dev
   ```

## Local Development (Testing SMS)

To test Twilio SMS callbacks locally, you must expose your Next.js local server to the Internet using `ngrok` or `localtunnel`.
1. Run `npx localtunnel --port 3000` (or `ngrok http 3000`).
2. Go to your Twilio Phone Number configuration on the Twilio Dashboard.
3. Set the "A MESSAGE COMES IN" Webhook to `https://<YOUR-NGROK-URL>/api/sms` (Method: HTTP POST).

You can test the **cron check** manually by securely calling the endpoint:
```text
GET http://localhost:3000/api/cron/hourly-check
Authorization: Bearer <YOUR_CRON_SECRET>
```

## Deployment on Vercel

Deployment is optimized for Vercel, which will automatically handle Next.js scaling and cron jobs. 

1. Push your repository to GitHub.
2. Link the repository to your Vercel Project.
3. In Vercel Settings -> Environment Variables, add **all** the keys from your `.env` file.
4. **Important for Cron**: For Vercel to trigger the background check smoothly, configure your `vercel.json` in the root:

```json
{
  "crons": [
    {
      "path": "/api/cron/hourly-check",
      "schedule": "0 * * * *"
    }
  ]
}
```

Wait, `vercel.json` is missing in this codebase currently! Please create `vercel.json` with the above contents before deploying.

All set! You can visit your deployment URL, setup your preferred schedules in the dashboard, and let the agent search flights for you.
