# TRAVEL-AGENT: Full Detailed Plan & Capabilities

## 1. Core Vision
The master plan is to create a fully independent, premium AI-powered personal travel assistant. Rather than relying on rigid dashboards or corporate travel sites, this tool provides real-time "Direct Flight Access" and acts as a booking engine that can interact with the user via both modern Web Chat (Natural Language) and automated SMS/WhatsApp logic. 

## 2. What The Platform Can Do (Current Capabilities)
The application is a dual-interface Next.js (App Router) execution combining AI orchestration and deterministic state-machine logic.

### A. The Conversational AI Web Platform (`/chat`)
- **Intent Parsing:** Powered by the DeepSeek (`deepseek-chat`) LLM integrated seamlessly via the Vercel AI SDK. The AI reads user natural language (e.g., *"Find me flights from San Francisco to JFK for next Friday"*).
- **Intelligent Tool Routing:** The AI natively calls the `searchFlights` background function using specific IATA codes. 
- **Live Flight Generation:** Fetches live flight itineraries (Airline, Flight Number, Price, Local Times) via the **Ignav Flight API**.
- **The "Safety Net" Fallback:** If the Ignav API returns no data (which happens with 0-result dates or connection drops), the system intercepts the error and dynamically synthesizes direct-booking URL links for Delta, United, and American Airlines using the user's requested origin, destination, and dates. This guarantees the user always gets a clickable booking resolution.

### B. The Automated SMS / WhatsApp Engine (Dashboard `/`)
- **User Registration:** Allows users to register their mobile phone number into the Postgres Database.
- **Flight Preferences:** Users define precise flight limits (e.g., Max Price, Nonstop Flights Only, Preferred Airlines, Earliest Departure Time).
- **Schedule Management:** Users can set recurring alerts (e.g., "Check SFO to NYC every Friday").
- **Twilio & Meta Integration:** Designed to interface externally with Twilio APIs and free Meta WhatsApp Webhooks.
- **Interactive State Machine:** Users text simple commands ("A" or "B") to interact with the backend SMS parser (`src/lib/stateMachine.ts`), prompting the database to cache `PendingOffers` and generate secure checkout SMS replies.
- **Local SMS Simulator (`/simulate`):** An internal Glassmorphism graphical interface to comprehensively test SMS logical state changes locally without paying for API telecom credits.

## 3. Technology Stack & Database Architecture
- **Framework:** Next.js 16 (App Router) over Node 20.
- **Database:** PostgreSQL (Hosted on Supabase).
- **ORM:** Prisma v5.22. 
  - Tables include: `User`, `Preference`, `Schedule`, `Conversation`, `ConversationMessage`, `PendingOffer`. 
- **Styling:** Bespoke Modular Vanilla CSS (`globals.css`) enforcing strict "Institutional Glassmorphism" aesthetics (dark card backgrounds, blurred backdrops, glowing accent buttons).

## 4. The End Goal
To deploy a continuous, zero-touch flight monitoring system where an end-user occasionally receives a WhatsApp message with a direct link to buy a heavily discounted flight meeting their strict criteria, supplemented by a beautiful Next.js web application for immediate ad-hoc planning.
