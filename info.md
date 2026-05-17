# Nawe — Gemma 4 Hackathon Writeup Notes

## Challenges

**Keeping the conversation warm, not clinical.** Early versions of the system prompt produced responses that felt like structured intake forms spoken aloud — clinical and cold. We iterated on the prompt to enforce "one question per exchange" and a warm, non-judgmental tone. The breakthrough was instructing the model to ask about *impact on daily life* rather than diagnostic markers, which is both more natural and more useful for urgency classification.

**Gemma 4's chain-of-thought leaking into responses.** The `gemma-4-31b-it` model returns thinking parts alongside the actual reply. The Google AI Studio API marks these with `"thought": true` in the response parts array. We filter these out before returning the message to the client — without this, users would see the model's internal reasoning process as part of the conversation.

**Function calling reliability.** Gemma 4 occasionally returns a text response instead of a function call, especially when the conversation is shorter than expected. We handle this in both edge functions: `gemma-session-notes` has an explicit fallback to save raw content if no tool call is returned; `gemma-triage` continues the conversation if `done: false`.

**Triage → matching integration.** The existing matching algorithm expected an `IntakeResponse` shape from the questionnaire. We wrote a `triageToIntake()` adapter that maps Gemma's triage output (`urgency`, `therapist_type`, `gender_preference`, `language_preference`) to the existing matching interface — no changes to the core algorithm, full backward compatibility with clients who completed the old questionnaire.

---

## Impact

Mental health platforms in East Africa fail at two points: the door (clients don't know how to describe what they need) and the back-office (therapists spend more time on documentation than clinical care). Nawe with Gemma 4 addresses both:

- A first-time user can describe their situation in Swahili, in plain language, and be matched to the right therapist in under 3 minutes
- A therapist with 8 sessions a day reclaims 2+ hours previously spent on notes

The Google AI Studio integration keeps infrastructure costs near zero for an early-stage product — no self-hosted models, no GPU servers. For a startup operating in an emerging market, that cost structure is what makes the product viable long-term. The architecture is also provider-agnostic: swapping to a self-hosted Ollama instance requires only changing one environment variable.
