# Nawe x Gemma 4 — AI-Powered Mental Health Intake for East Africa

> **Kaggle Gemma for Good Hackathon 2026**
> Track: Health & Sciences (Impact Track) + Main Track
> Special Track Target: Cactus (local-first mobile/edge application)

---

## The Problem

Kenya has approximately 1 psychiatrist per 1 million people. Most young people across East Africa who need mental health support never find it — not because they don't want to, but because the system was never built for them. Stigma, cost, geography, and poor connectivity compound an already broken access pipeline.

Nawe (nawe.co.ke) is a live digital mental health platform connecting individuals, corporate HR teams, and communities to licensed therapists across East Africa. The platform is co-founded and led by two licensed therapists with active clinical practices.

The missing layer: intelligent, privacy-preserving intake that matches the right person to the right therapist — in their language, on their device, without their most sensitive data ever leaving their control.

**Gemma 4 is that layer.**

---

## What We Built

A Gemma 4-powered intake and matching system wired into Nawe's existing React/TypeScript + Supabase platform. Three connected features. One complete user journey.

### 1. Gemma Triage — Conversational Intake
When a new user arrives on Nawe, instead of a static form, Gemma 4 conducts a warm, conversational intake — available in English and Swahili. Four to five exchanges assess:

- What the user is experiencing
- Emotional urgency
- Prior therapy history
- Therapist preferences (gender, language, therapeutic approach)

Gemma outputs structured JSON via native function calling:

```json
{
  "presenting_issue": "anxiety and work stress",
  "urgency": "moderate",
  "language_preference": "Swahili",
  "therapist_type": "CBT",
  "gender_preference": "female",
  "summary": "User experiencing persistent anxiety linked to workplace pressure. No prior therapy. Prefers Swahili-speaking female therapist."
}
```

This is stored against the user record in Supabase. The user sees a conversation — not a form.

### 2. Gemma Matching — Intelligent Therapist Recommendation
The triage JSON feeds directly into a matching query against therapist profiles in Supabase. Gemma's structured output defines the filter and ranking criteria — producing a semantically informed match, not a simple availability sort. The result surfaces in the existing Nawe booking flow.

### 3. Gemma Session Notes — Post-Session Support for Therapists
After a session is marked complete, the therapist triggers a session note. Gemma produces a structured clinical summary:

- Presenting issue
- Session focus
- Key observations
- Suggested follow-up actions

Saves therapists 15–20 minutes of administrative work per session. Validated by Nawe's clinical co-founders.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Nawe Frontend (React / TS)        │
│                                             │
│  [Triage Chat]   [Booking]   [Therapist     │
│                               Dashboard]    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│          Gemma 4 Service Layer              │
│          (Ollama — local inference)         │
│                                             │
│   /triage     /match     /session-notes     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│                Supabase                     │
│                                             │
│  users  │  therapists  │  sessions          │
│  triage_results  │  session_notes           │
└─────────────────────────────────────────────┘
```

---

## Why Gemma 4 Specifically

| Capability | How Nawe Uses It |
|---|---|
| **Native function calling** | Structured JSON output from triage conversations — reliable, parseable, not prompt-hacked |
| **Local inference via Ollama** | Mental health data never touches a third-party API — privacy by architecture |
| **Multilingual understanding** | Triage and notes in English and Swahili without fine-tuning |
| **Efficient 4B model** | Runs on modest hardware — deployable in low-resource East African server environments |
| **Multimodal (roadmap)** | Future: therapists upload mood journal images for Gemma-assisted review |

**The privacy argument is the core technical thesis:** Running Gemma 4 locally means the most sensitive conversation a young Kenyan may ever have — their first disclosure of a mental health struggle — is processed on-device or on a private server. No third-party model provider sees it. In a context where stigma is real and data trust is low, this is not a feature. It is a prerequisite for adoption.

---

## Hackathon Requirements Checklist

### Submission Requirements

| Requirement | Status | Notes |
|---|---|---|
| Kaggle Writeup (≤1,500 words) | 🔲 Due Day 21 | Architecture + Gemma 4 usage + challenges |
| YouTube Video (≤3 min) | 🔲 Due Day 20 | Demo + story + clinical co-founder on camera |
| Public Code Repository | 🔲 GitHub — push before deadline | Well-documented, Gemma 4 implementation visible |
| Live Demo URL | 🔲 Hosted demo endpoint | Ollama-backed, publicly accessible |
| Cover Image (Media Gallery) | 🔲 | Nawe branding + Gemma 4 |
| Track Selected | ✅ | Health & Sciences + Cactus special track |

### Tracks Entered

| Track | Prize | Basis |
|---|---|---|
| Main Track | Up to $50,000 | Overall vision, technical execution, storytelling |
| Health & Sciences (Impact) | $10,000 | Live mental health platform, LMIC context, clinical validation |
| Cactus (Special Technology) | $10,000 | Local-first Gemma 4 inference, privacy-preserving edge architecture |

---

## Evaluation Criteria

| Criteria | Points | Our Strategy |
|---|---|---|
| Impact & Vision | 40 | Real platform, real clinical co-founders, real East African mental health crisis |
| Video Pitch & Storytelling | 30 | Problem → Demo → Therapist perspective → Technical argument → Vision |
| Technical Depth & Execution | 30 | Gemma 4 function calling, local inference, structured output pipeline, public code |

**Key insight:** 70 of 100 points are won in the video. The code proves the demo is real.

---

## 21-Day Build Plan

### Week 1 — Gemma Setup + Triage (Days 1–7)

**Day 1–2: Environment setup**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull Gemma 4 4B
ollama pull gemma4:4b

# Verify
ollama run gemma4:4b "You are a warm mental health intake assistant..."
```

**Day 3–4: Triage system prompt engineering**
- Write and iterate the triage system prompt
- Define function calling schema for structured JSON output
- Target: consistent, warm, 4–5 exchange conversation → reliable JSON

**Day 5–7: Triage chat component**
- Build React chat UI component
- Wire to Ollama local API (`http://localhost:11434/api/chat`)
- Store triage JSON output in Supabase `triage_results` table

### Week 2 — Matching + Session Notes (Days 8–14)

**Day 8–10: Matching logic**
- Write Supabase query using triage JSON as filter criteria
- Return ranked therapist profiles
- Wire matched result into existing booking flow

**Day 11–13: Session notes endpoint**
- Build therapist-side UI — one button post-session
- Gemma generates structured note from session context
- Store in Supabase `session_notes` table

**Day 14: Integration testing**
- End-to-end walkthrough: triage → match → booking → session → notes
- Fix edge cases

### Week 3 — Polish + Submission (Days 15–21)

**Day 15–17: Demo path polish**
- Seed realistic therapist profiles
- Smooth the demo-critical user journey
- Does not need to be production-complete — demo-complete

**Day 18–19: Video production**
- Record screen demo
- Film therapist co-founder segment
- Edit to under 3 minutes
- Upload to YouTube (unlisted or public, no login required)

**Day 20: Kaggle writeup**
- 1,500 words max
- Sections: Problem, Solution, Architecture, Gemma 4 Usage, Challenges, Impact
- Attach video, GitHub repo, live demo URL

**Day 21: Final checks + submit**
- Code pushed and public on GitHub
- Live demo accessible
- Writeup submitted before 11:59 PM UTC, May 18 2026

---

## Video Structure (3 minutes)

| Timestamp | Content |
|---|---|
| 0:00–0:25 | **The problem.** 1 psychiatrist per 1M Kenyans. Map visual. Voice: *"Most young Kenyans who need mental health support never find it."* |
| 0:25–0:50 | **Nawe.** Platform overview. Co-founders introduced. The missing layer explained. |
| 0:50–1:45 | **Demo.** New user opens Nawe. Gemma triage in Swahili. Matched therapist appears. Booking completed. |
| 1:45–2:10 | **Therapist side.** Session ends. One click. Gemma session note generated. Co-founder on camera reacts. |
| 2:10–2:35 | **Technical argument.** Architecture diagram. Local inference. Privacy thesis stated clearly. |
| 2:35–3:00 | **Vision.** Nawe is live. This is not a demo — it is infrastructure East Africa's mental health system never had. |

---

## Repository Structure (target)

```
nawe-gemma/
├── README.md
├── frontend/
│   ├── components/
│   │   ├── TriageChat.tsx        # Gemma triage conversation UI
│   │   ├── TherapistMatch.tsx    # Matched therapist display
│   │   └── SessionNotes.tsx      # Therapist post-session UI
│   └── lib/
│       └── gemma.ts              # Ollama API client
├── backend/
│   ├── triage/
│   │   └── prompt.ts             # System prompt + function schema
│   ├── matching/
│   │   └── match.ts              # Supabase query logic
│   └── notes/
│       └── notes.ts              # Session note generation
├── supabase/
│   └── schema.sql                # triage_results + session_notes tables
└── prompts/
    ├── triage_system.md          # Triage system prompt (English)
    ├── triage_system_sw.md       # Triage system prompt (Swahili)
    └── session_notes.md          # Session notes prompt
```

---

## Kaggle Writeup Outline (≤1,500 words)

1. **Title:** Nawe — Gemma 4-Powered Mental Health Intake for East Africa
2. **The Problem** (~150 words) — mental health access gap in Kenya/East Africa
3. **The Solution** (~200 words) — three-feature pipeline overview
4. **How We Use Gemma 4** (~300 words) — function calling, local inference, multilingual, specific model choices
5. **Architecture** (~200 words) — diagram + component explanation
6. **Challenges & How We Solved Them** (~200 words) — prompt reliability, Swahili language quality, data privacy
7. **Real-World Impact** (~150 words) — clinical co-founders, live platform, therapist validation
8. **What's Next** (~100 words) — multimodal roadmap, mobile edge deployment, NGO partnerships
9. **Links** — GitHub, live demo, video

---

## Key Dates

| Date | Milestone |
|---|---|
| April 27, 2026 | Project start |
| May 3, 2026 | Gemma triage working end-to-end |
| May 10, 2026 | Matching + session notes complete |
| May 17, 2026 | Video uploaded, writeup drafted |
| **May 18, 2026** | **Final submission deadline — 11:59 PM UTC** |

---

## Team

| Name | Role |
|---|---|
| Fred Gitonga | CTO & Co-founder — backend infrastructure, Gemma 4 integration |
| Co-founder (Lead) | Licensed Therapist & CEO — clinical validation, triage design |
| Co-founder | Licensed Therapist & COO — session notes validation, therapist UX |

---

## Links

| Resource | URL |
|---|---|
| Platform | https://nawe.co.ke |
| GitHub Repository | TBD |
| Live Demo | TBD |
| Submission Video | TBD |
| Kaggle Writeup | TBD |

---

*Built for the Kaggle Gemma for Good Hackathon 2026. Nawe means "with you" in Swahili.*
