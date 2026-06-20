-- Reviews and ratings for therapists and events
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Reviewer display name stored at submission time (profiles table is not anon-readable)
  reviewer_name text,
  -- Subject: exactly one of these must be set
  therapist_id uuid REFERENCES public.therapists(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  -- Moderation: admin approves before going public
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One review per reviewer per subject
  CONSTRAINT reviews_one_per_therapist UNIQUE NULLS NOT DISTINCT (reviewer_id, therapist_id),
  CONSTRAINT reviews_one_per_event     UNIQUE NULLS NOT DISTINCT (reviewer_id, event_id),
  -- Must review exactly one thing
  CONSTRAINT reviews_exactly_one_subject CHECK (
    (therapist_id IS NOT NULL)::int + (event_id IS NOT NULL)::int = 1
  )
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can submit reviews" ON public.reviews;
CREATE POLICY "Clients can submit reviews"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Clients can update own pending reviews" ON public.reviews;
CREATE POLICY "Clients can update own pending reviews"
ON public.reviews FOR UPDATE
TO authenticated
USING (auth.uid() = reviewer_id AND status = 'pending')
WITH CHECK (auth.uid() = reviewer_id AND status = 'pending');

DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
CREATE POLICY "Anyone can view approved reviews"
ON public.reviews FOR SELECT
USING (status = 'approved');

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
CREATE POLICY "Admins can manage reviews"
ON public.reviews FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Reviewers can view own reviews" ON public.reviews;
CREATE POLICY "Reviewers can view own reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (auth.uid() = reviewer_id);

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Public view: approved reviews only, no join to profiles needed
CREATE OR REPLACE VIEW public.reviews_public AS
SELECT
  id,
  therapist_id,
  event_id,
  rating,
  comment,
  reviewer_name,
  created_at,
  true AS verified
FROM public.reviews
WHERE status = 'approved';

GRANT SELECT ON public.reviews_public TO anon, authenticated;
