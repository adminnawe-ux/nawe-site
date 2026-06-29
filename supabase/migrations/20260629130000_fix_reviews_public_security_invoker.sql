-- Fix Supabase security linter: views must use security_invoker so RLS
-- of the querying user is enforced rather than the view creator's permissions.
DROP VIEW IF EXISTS public.reviews_public;

CREATE VIEW public.reviews_public
  WITH (security_invoker = true)
AS
SELECT
  id,
  therapist_id,
  event_id,
  rating,
  comment,
  text,
  reviewer_name,
  verified,
  status,
  created_at
FROM public.reviews
WHERE status = 'approved';

GRANT SELECT ON public.reviews_public TO anon, authenticated;
