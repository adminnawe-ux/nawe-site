-- Extend payment_status to support waitlist states

-- Drop and recreate the check constraint on event_registrations
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_payment_status_check;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_payment_status_check
  CHECK (payment_status IN (
    'free',
    'pending_stk',
    'paid',
    'failed',
    'waitlisted',        -- capacity full; queued for admin approval
    'approved_waitlist'  -- admin approved; paid event user must now complete payment
  ));

-- Fast lookup: admins query waitlisted rows per event frequently
CREATE INDEX IF NOT EXISTS event_registrations_waitlist_idx
  ON public.event_registrations (event_id, payment_status)
  WHERE payment_status IN ('waitlisted', 'approved_waitlist');
