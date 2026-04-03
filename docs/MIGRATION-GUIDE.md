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
```

## 3. Edge Functions

Deploy the edge functions from `supabase/functions/`:

| Function | Purpose |
|---|---|
| `terms` | Returns Terms & Conditions as JSON |

```bash
supabase functions deploy terms
```

### Edge Function Secrets

These are auto-provided by Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

If you add AI features, set:
- `LOVABLE_API_KEY` — only works on Lovable Cloud; replace with your own AI provider keys

## 4. Auth Configuration

- Email auth is enabled by default
- Email confirmation is **required** (do not enable auto-confirm)
- The `handle_new_user` trigger auto-creates a profile and assigns the `client` role on signup

## 5. Storage

Two public buckets:
- `avatars` — therapist/user profile photos
- `article-covers` — blog article cover images

## 6. NPM Dependencies

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

## 7. Post-Migration Checklist

- [ ] Run `full-schema.sql` in SQL Editor
- [ ] Deploy edge functions
- [ ] Set environment variables
- [ ] Update `src/integrations/supabase/client.ts` with your project URL/key
- [ ] Regenerate types: `supabase gen types typescript --project-id your-id > src/integrations/supabase/types.ts`
- [ ] Test signup flow (email confirmation + terms acceptance)
- [ ] Test therapist onboarding (role enforcement)
- [ ] Verify storage uploads work
