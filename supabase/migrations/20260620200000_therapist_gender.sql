ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('Male', 'Female', 'Non-binary / Other'));
