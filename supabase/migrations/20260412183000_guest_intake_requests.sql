-- Let guests submit a session request without creating an account.
CREATE TABLE IF NOT EXISTS public.guest_intake_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_email text,
  contact_phone text,
  intake_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  crisis_flag boolean DEFAULT false,
  callback_requested boolean DEFAULT false,
  consent_accepted_at timestamptz,
  consent_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_intake_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests can submit intake requests" ON public.guest_intake_requests;
CREATE POLICY "Guests can submit intake requests"
ON public.guest_intake_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  contact_email IS NOT NULL OR contact_phone IS NOT NULL
);

DROP POLICY IF EXISTS "Admins can view guest intake requests" ON public.guest_intake_requests;
CREATE POLICY "Admins can view guest intake requests"
ON public.guest_intake_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_guest_intake_requests_updated_at ON public.guest_intake_requests;
CREATE TRIGGER update_guest_intake_requests_updated_at
  BEFORE UPDATE ON public.guest_intake_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
