# Website Repositioning & Therapist Slugs — Implementation Plan

Source: *Nawe Website Repositioning & Landing Page Restructure — IT Strategy Brief* (Sept 2026).
Branch: `feat/website-repositioning` (work stays off `main` until reviewed).

## Goals

1. Restructure the public site around three audiences — **People & Families**, **Communities & Partners**, **Organizations** — with Therapists as a professional-network pathway.
2. Reposition the brand: "With You, Every Step." / "Building healthier people, stronger communities, and better organizations."
3. Make Connect / Heal / Grow the *method*, not the audience buckets.
4. Introduce Organizational Health (Measure → Understand → Act → Measure Again) and Community Health as visible propositions.
5. Give therapists searchable public URLs: `nawe.co.ke/therapist/<name-slug>`.

## Non-goals

- No rebuild of underlying functions (booking, payments, portals). The brief explicitly asks to remap existing content, not rebuild it.
- No changes to portal pages (client/therapist/admin) beyond shared tokens.
- No new product features (Nawe OS, dashboards) — only the public messaging hooks for them.

---

## Phase 1 — Design tokens & shared foundation

Low risk, unblocks everything else.

- Move hardcoded navy `#000b3d` (used across `Index.tsx`, others) into a semantic token (e.g. `--brand-navy`) in `src/index.css` and `tailwind.config.ts`.
- Audit other one-off hex colors on public pages and map to tokens.
- No visual change intended in this phase — verify with a screenshot diff of the home page.

**Files:** `src/index.css`, `tailwind.config.ts`, `src/pages/Index.tsx` (token swap only).

## Phase 2 — Homepage restructure (`Index.tsx`)

Current: 475 lines, service-led sections. Target: journey-led.

New section order (from brief §09–10):

1. **Hero** — "With You, Every Step." + positioning line + supporting copy (brief §10).
2. **"What brings you here?"** — three path cards: *I Need Support* → People; *I Want to Support My Community* → Communities; *I Want to Strengthen My Organization* → Organizations. Therapists get a secondary text link ("Are you a therapist?").
3. **Recognition** — "Life doesn't always come with a clear roadmap…" (brief §10).
4. **Core idea** — "Wellbeing doesn't happen in isolation…"
5. **Nawe approach** — Connect · Heal · Grow as three method cards (short, plain language).
6. **Organizational Health** — "Your people are your organization…" with the Measure → Understand → Act → Measure Again loop as a visual.
7. **Community Health** — "Wellbeing grows where people connect."
8. **Existing content kept where valuable** — Stories/testimonials, Resources teaser, Partnerships, Reach across Africa — remapped under the audience sections, not deleted.
9. **Final CTA** — "You don't have to figure it out alone. Nawe is with you, every step."

**CTA rule (brief §12):** no default "Find a Therapist". Each section's CTA matches intent:
- People → Get support / Resources
- Communities → Programme enquiry
- Organizations → Request an assessment / consultation
- Therapists → Join the network

**Navbar:** replace the current Events / Blog / For Therapists / Login set with audience-led items (People, Communities, Organizations, Therapists, Resources, About) and keep Login / Sign Up.

**Files:** `src/pages/Index.tsx`, `src/components/Navbar.tsx`, `src/components/Footer.tsx`.

## Phase 3 — Audience landing pages

Brief §12 says existing content should be remapped, so most of these are restructured versions of existing pages, not new ones.

| New page | Built from | Primary CTA |
|---|---|---|
| `/people` (Individuals & Families) | `Matches`, `Triage`, `Resources`, `HowItWorks` | Get support |
| `/communities` | `Grow` (community parts), `Events` | Programme enquiry |
| `/organizations` | `Grow` (org parts), `ForTherapists` pattern | Request assessment |
| `/therapists` | `ForTherapists` (existing, reworded) | Join the network |

Keep existing URLs working via redirects: `/for-therapists` → `/therapists`, `/how-it-works` stays.

**Open question:** does `Grow.tsx` (396 lines) split into Communities + Organizations, or stay as one page with two sections? Decide before Phase 3 starts.

**Files:** new `src/pages/People.tsx`, `Communities.tsx`, `Organizations.tsx`; updates to `ForTherapists.tsx`, `Grow.tsx`, `App.tsx` routes.

## Phase 4 — Therapist slugs (`nawe.co.ke/therapist/<name-slug>`)

**4a. Database (migration, RLS-sensitive — flag in PR)**
- `ALTER TABLE therapists ADD COLUMN slug text;`
- Backfill from public display name: lowercase, ASCII-fold, hyphenate (`Jane Wanjiru` → `jane-wanjiru`).
- Collisions: append `-2`, `-3`… deterministically (ordered by `created_at`).
- `UNIQUE (slug)` constraint once backfilled; `NOT NULL` after backfill.
- Generate slug on insert/update of name (trigger or app-side helper — decide in review).

**4b. Routing & redirects**
- Add route `/therapist/:slug`. Keep `/therapist/:id` (UUID) and **redirect** to the slug URL so already-shared links keep working.
- `TherapistProfile.tsx`: resolve by slug; fall back to UUID for the redirect path.

**4c. Links**
- Audit every place a therapist link is built (`grep` for `/therapist/`) and switch to slug.
- Admin and therapist portal "Public Profile Link" (`AdminTherapists.tsx` currently builds `/therapist/${id}`) → slug.

**4d. Public visibility rule — keep as-is:** only `verified = true` therapists get a public page (matches the existing RLS policy). Confirm this with you before build.

**4e. SEO — the real decision (see below).**

**Files:** new migration `supabase/migrations/<ts>_therapist_slugs.sql`, `src/pages/TherapistProfile.tsx`, `src/App.tsx`, `src/pages/admin/AdminTherapists.tsx`, `src/pages/therapist/TherapistProfileEdit.tsx`, any `grep` hits.

## Phase 5 — SEO & discoverability

Required for the "easier to search" goal to actually work.

- Per-route `<title>` and `<meta name="description">` (currently one global title in `index.html`). A small head-management helper (`react-helmet-async` or equivalent) for public pages.
- `sitemap.xml` generated at build time, including all `verified` therapist slugs. Generation needs a build step that reads from Supabase — decide where it runs (CI vs. a scheduled edge function).
- `robots.txt` already exists; add sitemap reference.
- Structured data (`Person`/`Physician`-style JSON-LD) on therapist pages — optional, decide in review.

**Decision needed:** client-side SPA means crawlers may only see the shell on therapist pages. Options:
- **A.** Prerender the public routes at build time (static HTML per therapist/page). Best SEO; needs build-time data fetch.
- **B.** Client-rendered + per-route meta + sitemap. Simpler; Google does index JS, but more slowly and less reliably.

Recommendation: **A** for therapist pages and the three audience pages, since those are the search targets.

## Phase 6 — QA & rollout

- Screenshot diffs of each public page before/after (use the `run` skill against a local dev server).
- Mobile check on the new three-path entry.
- Lint, `tsc`, vitest, build — per CLAUDE.md, all must pass before PR.
- Redirect test: `/therapist/<uuid>` → `/therapist/<slug>`; old `/for-therapists` → `/therapists`.
- Stage on a Render preview before merging to `main`, since the frontend deploys on push to `main`.

---

## Decisions needed before Phase 2 starts

1. **Grow page:** split into Communities + Organizations, or one page with two sections?
2. **Therapist public visibility:** keep `verified = true` only?
3. **Public display name:** is the slug built from the full name, first name + surname initial, or a separate display name field?
4. **SEO approach:** prerender (recommended) vs. client-rendered + sitemap.
5. **Copy:** will you send final copy for sections not already in brief §10, and imagery for the "human photography" direction?

## Order of work

Phase 1 → Phase 2 → Phase 4 (slugs, independent of 2–3, can run in parallel) → Phase 3 → Phase 5 → Phase 6.

Phase 4's migration is the only RLS/schema-sensitive step, so it gets its own PR, reviewed separately from the visual work.
