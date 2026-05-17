-- Add payment tracking columns to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'failed'));

-- Index for fast lookups by payment reference during verification
CREATE UNIQUE INDEX IF NOT EXISTS sessions_payment_reference_idx
  ON sessions (payment_reference)
  WHERE payment_reference IS NOT NULL;
