# TRAVEL-AGENT: Remaining Work & Next Steps

This document outlines the exact priorities the next engineer or AI Agent must pursue to reach production deployment.

## 1. Immediate Critical Blocker: Database Connection
**Issue:** The application is currently emitting `FATAL: Tenant or user not found` during any Prisma query execution.
**Cause:** This is an external Supabase infrastructure block. The free-tier database cluster is actively paused/sleeping due to inactivity, or the regional router inside `.env` (`aws-0` vs `aws-1`) is mismatched.
**Action Required:**
1. The user must manually log into their Supabase Dashboard (`imsjyawhvqqgmumfxjyc`).
2. Un-pause the project instance.
3. Validate and copy the correct **Session Pooler (Port 5432)** connection string exactly into the `.env` `DATABASE_URL` file.

## 2. Connecting Production Webhooks (Telecom)
While the local SMS Simulator works (once the DB is active), the production SMS routing must be established.
**Action Required:**
- Deploy the repository to Vercel.
- Obtain the live HTTPS Vercel URL.
- Paste the live `/api/whatsapp` endpoint URL into the Meta Developer Console (WhatsApp Webhook Callback URL).
- (Optional) Paste the live `/api/sms` endpoint URL into the Twilio Console for SMS fallbacks.

## 3. Vercel Cron Scheduling
The system currently relies on manual triggers for searching schedules.
**Action Required:**
- The background flight scan logic needs an active CRON job.
- Configure `vercel.json` with an hourly schedule linking to an `/api/cron` endpoint.
- Verify `CRON_SECRET` validation logic protects the endpoint from public internet pings.

## 4. Refining AI Intelligence
**Action Required:**
- Optimize the AI Chatbot's system prompt to seamlessly read user `Preference` rows out of the Prisma database (e.g., if the user logged in and explicitly marked `nonstopOnly=true`, the AI should inject that as a default into its `searchFlights` tool parameters).
