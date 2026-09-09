-- Add structured SIRP (Situation, Intervention, Response, Plan) fields to
-- session_notes for therapists to fill in manually, alongside (or instead
-- of) the existing freeform `content` used by the AI note generator.
-- RLS already restricts this whole table to the owning therapist only
-- ("Therapists can manage own session notes") — no change needed there.

ALTER TABLE public.session_notes
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.session_notes
  ADD COLUMN IF NOT EXISTS situation text,
  ADD COLUMN IF NOT EXISTS intervention text,
  ADD COLUMN IF NOT EXISTS response text,
  ADD COLUMN IF NOT EXISTS plan text;
