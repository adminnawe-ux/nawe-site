-- Store explicit questionnaire consent in the database for auditability.
ALTER TABLE public.intake_responses
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text;
