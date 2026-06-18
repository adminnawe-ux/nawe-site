# Security Audit — June 2026

Audit performed across edge functions, RLS policies, and frontend.
Items marked **FIXED** are resolved. Open items need a dedicated work session.

---

## Fixed in this audit

| ID | Area | Fix |
|----|------|-----|
| C-1 | `verify-payment` price/currency from request body | Fetch `price_per_session` and `currency` from `therapists` table; ignore client-supplied values |
| C-3 | `query-event-payment` no ownership check | Return 403 if `lead.user_id !== caller.id`; legacy guest rows exempted |
| H-1 | `triage_results` RLS `USING (true)` exposed all mental health records to authenticated users | Dropped over-permissive policy; added scoped admin SELECT policy |
| H-4 | Clients could directly UPDATE `payment_status`, `price`, `currency` on sessions | Drop unrestricted client UPDATE policy; add trigger blocking sensitive-column writes from user-context requests |
| Auth gate | Unauthenticated users could open the ticket purchase dialog | Redirect to `/login?redirect_to=` before opening the dialog |

---

## Open — Critical

### C-2 · `add-event-guest`: No authentication
**File:** `supabase/functions/add-event-guest/index.ts`

No JWT check, no shared-secret header, no role verification. Any HTTP caller (not just browsers — CORS does not stop `curl` or server-to-server requests) can add arbitrary email addresses as guests to any Google Calendar event ID.

**Fix:** Add an `INTERNAL_SECRET` env var and require `Authorization: Bearer <secret>` from calling functions, OR inline this logic directly into `register-event` and `query-event-payment` so it is never a public endpoint.

---

## Open — High

### H-2 · NCBA webhook hash verification bypassed
**File:** `supabase/functions/ncba-payment-webhook/index.ts:133–142`

The HMAC is computed but the result is discarded with a `console.warn`. The only guard is a username/password pair embedded in the JSON body. An attacker with those credentials can POST a fake payment confirmation and trigger session/ticket delivery without any real payment.

**Fix:** Once NCBA confirms the hash algorithm and key format, uncomment the reject path. In the interim, move credentials to HTTP Basic Auth (`Authorization` header) rather than the request body.

---

### H-3 · `register-event`: No rate limiting
**File:** `supabase/functions/register-event/index.ts`

No per-user or per-IP rate limit. An attacker can:
- Spam STK push initiations (NCBA may rate-limit on their side, but our DB has no guard)
- Stuff event capacity with fake `pending_stk` registrations
- Exhaust Resend email credits with confirmation/waitlist emails

Note: auth is now required for registration (login gate added in this audit), which reduces the unauthenticated abuse surface. But an authenticated user can still abuse this.

**Fix:** Mirror the 3-per-hour STK push limit already in `initiate-stk-push`. Check how many `pending_stk` or `paid` registrations the user has created in the last hour before initiating a new STK push.

---

### ~~H-4~~ · ~~Clients can directly UPDATE `payment_status` on their sessions~~ — FIXED
**Migration:** sessions UPDATE policy has no column restriction.

Any authenticated client can call `supabase.from('sessions').update({ payment_status: 'paid' })` from the browser and bypass the payment flow.

**Fix:** Either remove the client UPDATE policy and route all updates through edge functions (preferred), or add a Postgres trigger that raises an exception if a client attempts to modify `payment_status`, `price`, `currency`, or `therapist_id`.

---

### H-5 · `gemma-triage`: Unauthenticated, wildcard CORS, trusts request-body `user_id`
**File:** `supabase/functions/gemma-triage/index.ts`

No JWT required. Any caller can supply any `user_id` and write AI-generated triage data under that user's account, burning Google AI API credits with no rate limiting.

**Fix:** Require `Authorization` header; derive `user_id` from `authClient.auth.getUser()` server-side rather than trusting it from the request body. Change `Access-Control-Allow-Origin: *` to `APP_URL`.

---

### H-6 · `gemma-session-notes`: Wildcard CORS
**File:** `supabase/functions/gemma-session-notes/index.ts:4`

Uses `'Access-Control-Allow-Origin': '*'` while every other function restricts to `APP_URL`. The function is auth-gated (JWT + therapist role check) so exploitation risk is lower, but the inconsistency is a gap.

**Fix:** `'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'`

---

## Open — Medium

### M-1 · `register-event` uses `select('*')` on events and tiers
`register-event/index.ts:229, 245` — Loads all columns into memory including internal fields (`google_calendar_id`, `created_by`, etc.). No data is leaked to the client but an inadvertent log statement could expose these fields.

**Fix:** Enumerate only the columns the function actually uses.

---

### M-2 · `guest-request` rate limit skipped for phone-only submissions
`supabase/functions/guest-request/index.ts:15–18` — `if (!email) return true` bypasses rate limiting entirely. An attacker omitting the email field can spam the crisis callback flow, exhausting Resend credits and on-call attention with no limit.

**Fix:** Add phone-based rate limiting as the fallback, or require at least one contact field before allowing the submission.

---

### M-3 · Admin email addresses hardcoded in a version-controlled migration
`supabase/migrations/20260412154500_admin_allowlist.sql` — Three admin emails are visible to anyone with repository read access. Adding or removing admins requires a new migration.

**Fix:** Manage admin roles through the Supabase Auth dashboard directly, or store the allowlist in a separate admin-managed table outside of migrations.

---

### M-6 · `platform_settings` readable by all authenticated users
The SELECT policy is `TO authenticated USING (true)`. Currently only stores support contacts and commission config, but any future sensitive config added here becomes immediately readable by all users.

**Fix:** Restrict to admins, or split into a public-safe settings table and a private admin-only table.

---

### M-7 · NCBA webhook amount check is one-directional
`supabase/functions/ncba-payment-webhook/index.ts:192–195` — Checks for underpayment (`transAmount < expected - 1`) but accepts unlimited overpayment silently.

**Fix:** Also flag `transAmount > expected + 1` for manual reconciliation rather than auto-confirming.

---

### M-8 · `notes_client` visible in therapist's session SELECT policy
Therapist SELECT policy fetches all columns including the client's private pre-session notes. Likely intentional for therapy context but undocumented.

**Action:** Confirm intent and add an inline comment. If notes should be private, move to a separate client-only table.

---

## Open — Low / Info

| ID | File | Issue |
|----|------|-------|
| L-1 | `src/components/ui/chart.tsx:70` | `dangerouslySetInnerHTML` used for config-derived CSS — safe, but add a comment confirming no user input reaches it |
| L-2 | Multiple edge functions | NCBA response bodies logged in production — may expose transaction metadata in Supabase logs |
| L-3 | `supabase/functions/get-event-ticket/index.ts` | Unauthenticated ticket lookup returns attendee name and email by ticket code |
| L-4 | Multiple edge functions | In-memory NCBA token cache not shared across instances; multiple instances fetch independently under load |
| L-5 | sessions availability migration | `therapist_availability` SELECT policy is `TO authenticated` — excludes anonymous users who browse therapist pages without logging in |
| L-6 | Multiple edge functions | Resend `fetch()` calls have no timeout — slow Resend API blocks payment confirmation response |
