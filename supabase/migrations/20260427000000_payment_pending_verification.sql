-- Extend payment_status to include pending_verification state
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_payment_status_check;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_payment_status_check
    CHECK (payment_status IN ('unpaid', 'pending_verification', 'paid', 'failed'));

-- Track how much goes to the therapist vs platform after admin confirms
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS therapist_payout numeric,
  ADD COLUMN IF NOT EXISTS platform_commission numeric;
