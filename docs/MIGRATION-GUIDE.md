# Nawe Wellness — Migration Guide

## Prerequisites

- A Supabase project (or self-hosted Supabase instance)
- Node.js 18+
- The frontend codebase

## 1. Database Setup

Run `docs/full-schema.sql` in your Supabase SQL Editor (or via `psql`). It creates everything in order:

1. Enums
2. Tables (with constraints & defaults)
3. Functions (has_role, handle_new_user, validate_therapist_role, update_updated_at)
4. Triggers (auth user creation, role enforcement, updated_at)
5. RLS policies (all tables)
6. Storage buckets (avatars, article-covers) with policies
7. Seed data (commission tiers, platform settings)

## 2. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_APP_URL=https://nawe.co.ke
```

## 3. Edge Functions

Deploy the edge functions from `supabase/functions/`:

| Function | Purpose |
|---|---|
| `terms` | Returns Terms & Conditions as JSON |
| `guest-request` | Sends guest follow-up and callback emails via Resend |

```bash
supabase functions deploy terms
supabase functions deploy guest-request
```

### Edge Function Secrets

These are auto-provided by Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

For email delivery, set:
- `RESEND_API_KEY` — replace `re_xxxxxxxxx` with your real Resend API key
- `RESEND_FROM_EMAIL` — a verified sender address on your domain, for example `support@nawe.co.ke`
- `ALERT_TO_EMAIL` — internal inbox or comma-separated group alias that receives urgent callback and guest-intake alerts
- `APP_URL` — the public site URL used in transactional emails

## 4. Auth Configuration

- Email auth is enabled by default
- Email confirmation is **required** (do not enable auto-confirm)
- The `handle_new_user` trigger auto-creates a profile and assigns the `client` role on signup
- In Supabase Dashboard, set Authentication > URL Configuration > Site URL to your live site, for example `https://nawe.co.ke`
- Add your live domain and any preview domains to the redirect allow list
- The frontend uses `VITE_APP_URL` for sign-up and password-reset emails, so keep it aligned with your production domain
- Questionnaire submissions can now be completed as a guest, but the guest flow requires at least one contact method so the team can follow up.

## 5. Kenya Data Protection Checklist

Because the live site collects account details and mental-health intake data, treat this as a personal-data and sensitive-data processing system.

- Register the business with the Office of the Data Protection Commissioner if you have not already done so.
- Keep a written privacy notice that names the controller, contact details, purposes, lawful bases, retention periods, and rights.
- Use a separate, explicit consent flow for questionnaire or other health-related data.
- Run a DPIA before adding new profiling, analytics, messaging, or AI features.
- Document any transfer of data to processors outside Kenya, including hosting and email providers.
- Keep a breach-response process for investigation and notification.
- Review therapist/admin access regularly so staff only see the minimum data they need.

## 6. Storage

Two public buckets:
- `avatars` — therapist/user profile photos
- `article-covers` — blog article cover images

## 7. NPM Dependencies

Key packages beyond React/Vite/Tailwind:

```
@supabase/supabase-js
@tanstack/react-query
react-router-dom
react-hook-form + @hookform/resolvers + zod
recharts
lucide-react
date-fns
sonner
shadcn/ui components (radix-ui primitives)
```

## 8. Post-Migration Checklist

- [ ] Run `full-schema.sql` in SQL Editor
- [ ] Deploy edge functions
- [ ] Set environment variables
- [ ] Set `VITE_APP_URL` to the production domain
- [ ] Update `src/integrations/supabase/client.ts` with your project URL/key
- [ ] Regenerate types: `supabase gen types typescript --project-id your-id > src/integrations/supabase/types.ts`
- [ ] Test signup flow (email confirmation + terms acceptance)
- [ ] Test therapist onboarding (role enforcement)
- [ ] Verify storage uploads work
- [ ] Confirm privacy policy, terms, and consent text match the live product
