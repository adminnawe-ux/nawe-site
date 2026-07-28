-- Admin broadcast tool: opt-out flag for registered users + a log of past sends.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS broadcast_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.broadcast_sends (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject text NOT NULL,
  body text NOT NULL,
  audience_roles text[] NOT NULL DEFAULT '{}',
  include_newsletter boolean NOT NULL DEFAULT false,
  recipient_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sent_by uuid NOT NULL REFERENCES auth.users(id),
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view broadcast sends" ON public.broadcast_sends;
CREATE POLICY "Admins can view broadcast sends"
ON public.broadcast_sends
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Inserts happen only via the send-broadcast edge function (service role key),
-- so no INSERT policy for authenticated/anon is needed.
