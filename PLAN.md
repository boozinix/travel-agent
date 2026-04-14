# TRAVEL-AGENT: Development Plan & Status Update

## 1. Project Goal & Intent
The primary objective is to build a premium, locally-testable flight booking engine. The user wants to own a highly stylized standalone product that completely removes reliance on generic third-party travel planners. It emphasizes "Direct Flight Access" (offering direct links to book via airlines) rather than just analytical capability. The platform accommodates multiple user workflows: 
1. **A web-based ChatGPT-style interface** for instantaneous booking requests.
2. **An automated background system** that routinely searches for recurring flights between major hubs (e.g. NYC -> SFO) and alerts the user natively via SMS when criteria are met.

## 2. Completed Milestones
✅ **Core UI / Aesthetics:** Built a rigorous, high-fidelity UI utilizing "institutional grade" Glassmorphism across the Dashboard, SMS Simulator, and the AI Chat page.
✅ **AI SDK Integration:** Fully connected the DeepSeek LLM through an OpenAI-compatible layer within Next.js API Routes, successfully generating live streaming text to the client.
✅ **Intelligent Tool Binding (Web Chat):** Created `flightSearch.ts` and bound it to the AI. When a user asks for a route, the AI securely executes the tool, fetches the Ignav API, and parses JSON airline schedules natively into the conversation.
✅ **No-Result Fallbacks:** Implemented a robust fallback system. If the Ignav API fails to find live data on a specific date, the backend seamlessly dynamically crafts functional, pre-filled URL query links directly to Delta, United, and American Airlines checkout pages to ensure the user is never left without booking options.
✅ **SMS State Engine:** Rebuilt the `stateMachine.ts` to manage step-by-step text messaging logic. The simulator layout was updated and fully tracks `IDLE`, `ASK_TRIP_DATE`, and `CONFIRM_OPTION`.
✅ **Dashboard Restoration:** Brought back the main user registry and preference dashboard that was temporarily lost during a major refactor. Added defensive Prisma error boundary catching. 

## 3. Current Blockers (Immediate Next Steps)
⏳ **Supabase Re-activation:** The application currently cannot perform any actions that require state persistence (e.g., using the SMS Simulator or saving preferences) because the Supabase cluster is returning `FATAL: Tenant or user not found`. 
**Immediate Fix:** The user needs to log into their Supabase host, un-pause the database instance, and confirm the `DATABASE_URL` uses the correct AWS region router (e.g. `aws-0` vs `aws-1`).

## 4. Pending Features / Future Roadmap
- **Production Deployment:** Once local testing is verified, deploy the Next.js app to Vercel. 
- **Webhook Binding:** Assign the live Vercel URL to the Twilio / Meta WhatsApp dev consoles so outside texts physically route into `stateMachine.ts`.
- **CRON Job Registration:** Map the `CRON_SECRET` to Vercel Cron to enable the hourly automated background searches for saved recurring trip preferences.
- **Feature Expansion:** Provide the AI Chatbot with the ability to interface with user constraints (e.g., teaching it to read `nonstopOnly` User preferences directly from the Postgres DB).
