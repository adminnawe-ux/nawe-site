# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server at http://localhost:8080
npm run build        # production build
npm run lint         # ESLint (must pass — 0 errors before merge)
npx tsc --noEmit     # type check
npm run test         # run all Vitest tests once
npm run test:watch   # Vitest in watch mode
npx vitest run src/lib/therapist.test.ts   # run a single test file

# Edge function tests (Deno, no local Supabase needed)
deno test --allow-env supabase/functions/initiate-stk-push/index.test.ts
```

CI runs lint → tsc → vitest → vite build, plus a separate Deno job for edge function tests. Both must pass before merging to main.

## Architecture

### Stack
Vite + React 18 + TypeScript, React Router v6, TanStack Query, Tailwind CSS + shadcn/ui, Supabase (Postgres + Auth + Edge Functions), Resend (email), NCBA STK Push (M-Pesa payments), Google Gemma (AI triage/notes).

### Path alias
`@/` maps to `src/`. Use it everywhere instead of relative paths.

### Routing & layouts (`src/App.tsx`)
Four layout shells wrap routes via React Router `<Outlet>`:
- `ClientLayout` — public pages (Navbar + Footer)
- `ClientPortalLayout` — authenticated client pages (`/dashboard`, `/settings`)
- `TherapistLayout` — therapist portal (`/therapist-portal/*`)
- `AdminLayout` — admin panel (`/admin/*`)

`ProtectedRoute` wraps layout shells; it reads `roles` from `AuthContext` and redirects unauthenticated or wrong-role users. The three roles are `client`, `therapist`, `admin` — stored in the `user_roles` table and loaded into context at login.

### Auth (`src/contexts/AuthContext.tsx`)
Single context wrapping the entire app. Exposes `user`, `session`, `roles`, `loading`. Roles are fetched from `user_roles` on auth state change. `loading` stays `true` until both the Supabase session AND the roles query have resolved — important for guarded routes.

### Supabase integration
- Client: `src/integrations/supabase/client.ts` — typed with generated `Database` type from `src/integrations/supabase/types.ts`
- Always import the client as `import { supabase } from "@/integrations/supabase/client"`
- DB schema lives in `supabase/migrations/` — add new migrations as timestamped `.sql` files
- Row-level security is enabled on all tables; admin operations use the service role key only inside edge functions

### Edge functions (`supabase/functions/*/index.ts`)
Written in Deno TypeScript. Each function:
1. Sets `corsHeaders` using `APP_URL` env var for `Access-Control-Allow-Origin` (restricts to the configured origin)
2. Handles `OPTIONS` preflight immediately
3. Verifies the caller's JWT via an anon-key Supabase client, then uses service-role client for DB writes
4. Returns `ResultCode: "0"/"1"` for NCBA webhook callbacks; standard JSON for browser-facing functions

The `gemma-triage` and `gemma-session-notes` functions call Google's Gemma API via `GOOGLE_AI_API_KEY`. The STK push flow spans three functions: `initiate-stk-push` → `query-stk-push` (browser polling) and `ncba-payment-webhook` (NCBA push callback). NCBA's query API returns FAILED for internal errors — treat any description containing "error"/"internal" as still-pending and rely on the webhook for authoritative confirmation.

### Payment flow (M-Pesa STK push)
1. `initiate-stk-push` calls NCBA API, creates a `sessions` row with `payment_status = pending_stk`, returns `{ session_id, transaction_id }`
2. Browser polls `query-stk-push` every 4 s (up to 15×). If NCBA query returns an API error, function returns `{ status: 'pending' }` so polling continues
3. NCBA calls `ncba-payment-webhook` when payment lands — this is the authoritative confirmation. Webhook matches sessions with `payment_status IN ('pending_stk', 'pending_verification', 'failed')` (the `failed` case covers sessions prematurely failed by the poller)

Key env vars for the STK flow: `NCBA_STK_USERNAME`, `NCBA_STK_PASSWORD` (Basic auth to get token), `MPESA_PAYBILL` (880100), `MPESA_ACCOUNT` (231112), `NCBA_WEBHOOK_USERNAME`/`NCBA_WEBHOOK_PASSWORD` (credentials NCBA sends to our webhook), `NCBA_SECRET_KEY` (hash verification — currently bypassed pending NCBA clarification).

### Event ticket tiers (`event_ticket_tiers` table)
Each event can have multiple ticket tiers (e.g. Early Bird, Regular, Men Only, Group of 4). Key fields:
- `ticket_type`: `'individual'` or `'group'`
- `group_size`: required when `ticket_type = 'group'` (≥ 2); STK push charges `price × group_size`
- `capacity`: per-tier hard cap (enforced by `register-event`); `NULL` = unlimited
- `sale_starts_at` / `sale_ends_at`: date gates — hard errors if outside window (not bypassable by waitlist)
- `sort_order`: display order

Group ticket flow: lead pays full amount in one STK push; `register-event` creates one row per member (linked via `group_lead_id`); on payment confirmation all member rows flip to `paid` and each gets a ticket email.

Admin UI (`src/pages/admin/AdminEvents.tsx`) includes a `TierManager` component for adding/removing/reordering tiers in the event form. The attendees panel shows per-tier stats (sold / capacity / checked-in / revenue).

### Event waitlist
When an event's total capacity is full (counting `ACTIVE_STATUSES = ['free', 'paid', 'pending_stk', 'approved_waitlist']`), `register-event` creates a `waitlisted` registration and returns `{ waitlisted: true }`. The `waitlisted` status does NOT count toward capacity.

**Waitlist approval flow (admin):**
1. Admin selects waitlisted registrations in the Waitlist tab of the attendees panel and clicks "Approve N"
2. The `approve-waitlist` edge function is called (admin-only, verifies role)
3. Free event → status becomes `free`, ticket email sent immediately
4. Paid event → status becomes `approved_waitlist`, email sent asking user to complete payment

**`approved_waitlist` status:** counts toward capacity (slot is reserved). When the user opens the event page they see a "Complete Payment" button. Clicking it opens the registration dialog pre-filled with their tier. The `register-event` function has a fast-path: if the caller has an `approved_waitlist` row, it skips the duplicate guard and updates the existing row with a new STK `payment_reference`.

**`payment_status` values:**
- `free` — registered, no payment required
- `pending_stk` — STK push sent, awaiting M-Pesa confirmation
- `paid` — payment confirmed
- `failed` — STK push failed or expired
- `waitlisted` — event full; queued for admin approval
- `approved_waitlist` — admin approved; paid-event user must complete payment

**Edge functions involved:**
- `register-event` — handles tier validation, capacity check, group creation, waitlist, approved_waitlist resume
- `query-event-payment` — polls NCBA for event STK push status; marks lead + all group members
- `ncba-payment-webhook` — authoritative confirmation; handles both session-booking and event-registration payments
- `approve-waitlist` — admin-only; approves selected waitlisted registrations

### Styling conventions
Tailwind only. Three font utility classes used throughout:
- `font-display` — headings
- `font-ui` — labels, buttons, nav
- `font-body` — body text, descriptions

Colours use semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `text-primary`, `text-success`, `text-destructive`). Avoid hardcoded colours.

### Key site constants (`src/lib/site.ts`)
`SUPPORT_PHONE`, `SUPPORT_EMAIL`, `AUTH_REDIRECT_URL`, `APP_URL`. Import these rather than hardcoding values.

### Scripts (`scripts/`)
One-off Node.js `.mjs` scripts for operational tasks (sending emails, testing NCBA API). They load `.env` manually and are not part of the build. Run with `node scripts/<name>.mjs`.

### This project is NOT Next.js
It is a Vite + React Router SPA. Ignore any suggestions about `"use client"`, App Router, or Next.js conventions.
