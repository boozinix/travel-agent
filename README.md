# Travel Agent — SMS flight assistant

Next.js dashboard + Twilio SMS + Prisma + Postgres (Supabase) + Kiwi Tequila flight search.

## Local dashboard

```bash
cp .env.example .env
# fill DATABASE_URL and optional keys
npm install
npm run db:push
npm run dev
```

Open **http://localhost:3020** (port is fixed in `package.json` and `APP_DEV_PORT`).

## Free / cheap integrations (do these in order)

| Integration | Cost | What you do |
|-------------|------|-------------|
| **Supabase** | Free Postgres tier | Create project → copy `DATABASE_URL` → `npm run db:push` |
| **Kiwi Tequila** | Free API key | [tequila.kiwi.com/portal](https://tequila.kiwi.com/portal/) → `TEQUILA_API_KEY` |
| **Twilio** | Trial credit, then ~$0.0079/SMS | Buy SMS-capable number → Messaging webhook `POST` → your `/api/sms` URL |
| **Vercel** | Free hobby | Connect repo → env vars → deploy; cron in `vercel.json` hits `/api/cron/hourly-check` |
| **ngrok** (local SMS) | Free tier | `ngrok http 3020` → set `TWILIO_WEBHOOK_URL` to `https://….ngrok-free.app/api/sms` |

Optional: set `TWILIO_VALIDATE_SIGNATURE=false` while debugging locally; use real validation in production.

## GitHub

```bash
git init
git add .
git commit -m "Initial travel-agent SMS assistant"
gh repo create travel-agent --private --source=. --remote=origin --push
```

Use your own repo name if you prefer. Without GitHub CLI, create an empty repo on GitHub and `git remote add origin …` then `git push -u origin main`.

## API routes

- `POST /api/sms` — Twilio inbound webhook (TwiML reply)
- `GET /api/cron/hourly-check` — scheduled digest (Bearer `CRON_SECRET` on Vercel)
- `GET /api/health` — JSON status (no secrets)
