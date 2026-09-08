-- Restrict therapist visibility of sessions to paid sessions only.
-- Previously therapists could see every session tied to them regardless of
-- payment_status (unpaid, pending_stk, pending_verification, failed), which
-- meant unpaid/abandoned bookings showed up in their calendar and could be
-- "confirmed" via the UI before payment ever succeeded.
DROP POLICY IF EXISTS "Therapists can view own sessions" ON public.sessions;

CREATE POLICY "Therapists can view own sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = sessions.therapist_id AND t.user_id = auth.uid())
    AND sessions.payment_status = 'paid'
  );

-- Track the Google Calendar event created when a session is confirmed, so
-- create-session-calendar-event can skip re-creating one on retries.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS google_calendar_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text;
