-- Broadcast audience: confirmed attendees of one event.

-- Guest event attendees have no account (profiles.broadcast_opt_out) and no
-- newsletter row, so their unsubscribe is recorded by email here.
-- Written by unsubscribe-broadcast and read by send-broadcast (service role).
CREATE TABLE IF NOT EXISTS public.broadcast_suppressions (
  email      text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view broadcast suppressions" ON public.broadcast_suppressions;
CREATE POLICY "Admins can view broadcast suppressions"
ON public.broadcast_suppressions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Which event's attendees a broadcast went to (audit log)
ALTER TABLE public.broadcast_sends
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
