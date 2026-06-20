-- Extend the existing reviews table with new columns needed for
-- event reviews, moderation workflow, and public display without
-- joining the profiles table (which is not anon-readable).

-- Add event support
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;

-- Add moderation status; backfill existing rows as 'approved'
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected'));

UPDATE public.reviews SET status = 'approved' WHERE status = 'pending';

-- Store reviewer display name at submit time (profiles is not anon-readable)
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_name text;

-- reviewer_id alias — keep client_id for backward compat, add reviewer_id as alias
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.reviews SET reviewer_id = client_id WHERE reviewer_id IS NULL;

-- comment alias for the text column (text is a reserved word and error-prone)
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS comment text;

UPDATE public.reviews SET comment = text WHERE comment IS NULL;

-- updated_at
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tighten RLS: replace the open "USING (true)" policy with status-scoped one
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view approved reviews"
ON public.reviews FOR SELECT
USING (status = 'approved');

DROP POLICY IF EXISTS "Reviewers can view own reviews" ON public.reviews;
CREATE POLICY "Reviewers can view own reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (auth.uid() = client_id OR auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Clients can create reviews" ON public.reviews;
CREATE POLICY "Clients can submit reviews"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_id OR auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Clients can update own reviews" ON public.reviews;
CREATE POLICY "Clients can update own pending reviews"
ON public.reviews FOR UPDATE
TO authenticated
USING ((auth.uid() = client_id OR auth.uid() = reviewer_id) AND status = 'pending')
WITH CHECK ((auth.uid() = client_id OR auth.uid() = reviewer_id) AND status = 'pending');

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
CREATE POLICY "Admins can manage reviews"
ON public.reviews FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Public view: approved reviews only, no join to profiles
DROP VIEW IF EXISTS public.reviews_public;
CREATE VIEW public.reviews_public AS
SELECT
  id,
  therapist_id,
  event_id,
  rating,
  comment,
  -- expose text column under old name too for backward compat
  text,
  reviewer_name,
  verified,
  status,
  created_at
FROM public.reviews
WHERE status = 'approved';

GRANT SELECT ON public.reviews_public TO anon, authenticated;
