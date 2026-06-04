-- Add pending_stk status for STK push initiated payments
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_payment_status_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_payment_status_check
    CHECK (payment_status IN ('unpaid', 'pending_verification', 'pending_stk', 'paid', 'failed'));
