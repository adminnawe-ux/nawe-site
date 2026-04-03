-- Articles table for content management
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  category text NOT NULL DEFAULT 'general',
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  author_id uuid NOT NULL,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published articles
CREATE POLICY "Anyone can view published articles"
ON public.articles FOR SELECT
USING (status = 'published');

-- Admins can manage all articles
CREATE POLICY "Admins can manage articles"
ON public.articles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Allow admins to read all profiles (needed for client management)
-- The existing policy is RESTRICTIVE, let's add a permissive one
CREATE POLICY "Admins can view all profiles permissive"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all sessions permissively
CREATE POLICY "Admins can manage sessions permissive"
ON public.sessions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));