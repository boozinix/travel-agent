# TRAVEL-AGENT: AI & SMS Flight Booking Platform

## 1. Project Overview & Architecture
This is a dual-interface Next.js (App Router) application designed to serve as a personalized, premium travel booking agent. It provides two distinct ways for users to find flights:
1. **Interactive AI Web Chat** (`/chat`): A natural-language interface powered by DeepSeek and the Vercel AI SDK. It maps user intent to specific flight search API tools exactly like an intelligent agent.
2. **Automated SMS Alerts** (`/` and `/simulate`): A database-backed state machine that tracks user schedules, queries flight APIs via CRON, and interfaces with users natively via Twilio SMS or WhatsApp.

Users expect an independent, unique product that is fully testable locally on Port `3020` before any production deployment. 

## 2. Technology Stack
- **Framework:** Next.js 16 (App Router)
- **Database ORM:** Prisma 5 (connected to Postgres via Supabase)
- **AI Infrastructure:** Vercel AI SDK (`ai`, `@ai-sdk/openai`), DeepSeek (`deepseek-chat`) endpoint natively mocked over OpenAI formats.
- **Styling:** Vanilla CSS (`globals.css`, CSS Modules) utilizing strict **Glassmorphism** and premium dark-mode aesthetics. *DO NOT USE TAILWINDCSS.*
- **Flight Data API:** Ignav (`https://ignav.com`)

## 3. Core Capabilities & File Structure
- `src/app/page.tsx` & `src/app/actions.ts`: The root Dashboard. Manages user preferences, registers phone numbers, and displays the "Server Status" error-catch blocks natively.
- `src/lib/stateMachine.ts`: The core conversational brain for the SMS platform. Handles step-by-step logic (`IDLE` -> `ASK_TRIP_DATE` -> `CONFIRM_OPTION`).
- `src/app/api/chat/route.ts`: Web Chat endpoint. Employs a custom robust Streaming Polyfill to ensure reliable chunking via the `X-Vercel-AI-Data-Stream` protocol. Configured with a `searchFlights` AI Tool.
- `src/lib/flightSearch.ts`: Connects to Ignav to find live flights. **Crucial detail:** Includes a robust fallback mechanism that automatically generates direct booking URLs to Delta, United, and American Airlines if the Ignav API returns 0 itineraries for a given date.
- `src/app/simulate/page.tsx`: SMS Simulator interface to visually test the `stateMachine` locally without burning Twilio credits.

## 4. Critical Dependencies / Known Issues (GOTCHAS)
- **Database Dropouts:** The Supabase database occasionally suspends due to free-tier inactivity, which results in Next.js throwing `Invalid Prisma... Error querying the database: FATAL: Tenant or user not found`. This is *not* a code/module-export issue. The user must manually "Restore" the project in the Supabase Dashboard. The dashboard at `/` will elegantly catch this error, but writes and `/simulate` will crash.
- **Flight API Fallbacks:** The prompt for the AI Chatbot is strictly instructed to only search *once* using standard IATA codes (e.g. `JFK`, `SFO`). If $0 live pricing is returned, the agent is trained to yield the fallback links. 
- **Exports:** Database client is exported from `src/lib/db.ts` natively as *both* `db` and `prisma` to prevent Turbopack circular caching errors from crashing server-components. Do not change this structure.
