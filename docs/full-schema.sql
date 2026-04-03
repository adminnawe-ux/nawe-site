-- ============================================================
-- NAWE WELLNESS — COMPLETE DATABASE SCHEMA
-- Generated: 2026-03-08
-- ============================================================
-- Run this in order on a fresh Supabase project.
-- Prerequisites: Supabase project with auth.users table (default).
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('client', 'therapist', 'admin');


-- ============================================================
-- 2. TABLES
-- ============================================================

-- User profiles (extends auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  first_name text,
  last_name text,
  avatar_url text,
  phone text,
  location text,
  country text,
  timezone text,
  terms_accepted_at timestamp with time zone,
  terms_version text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Public therapist names and avatars only
CREATE VIEW public.therapist_public_profiles AS
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  p.avatar_url
FROM public.profiles p
JOIN public.therapists t ON t.user_id = p.user_id
WHERE t.verified = true;

GRANT SELECT ON public.therapist_public_profiles TO anon, authenticated;

-- Public review summary view without review text
CREATE VIEW public.reviews_public AS
SELECT
  id,
  therapist_id,
  rating,
  verified,
  created_at
FROM public.reviews;

GRANT SELECT ON public.reviews_public TO anon, authenticated;

-- Role-based access control
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Therapist profiles
CREATE TABLE public.therapists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  professional_title text,
  license_number text,
  issuing_body text,
  years_experience integer,
  bio text,
  tagline text,
  photo_url text,
  video_url text,
  specialisations text[] DEFAULT '{}'::text[],
  modalities text[] DEFAULT '{}'::text[],
  languages text[] DEFAULT '{English}'::text[],
  session_formats text[] DEFAULT '{}'::text[],
  client_populations text[] DEFAULT '{}'::text[],
  cultural_competencies text[] DEFAULT '{}'::text[],
  education text,
  price_per_session integer,
  currency text DEFAULT 'KES'::text,
  sliding_scale boolean DEFAULT false,
  sliding_scale_min integer,
  insurance_accepted text[] DEFAULT '{}'::text[],
  cancellation_policy text,
  verified boolean DEFAULT false,
  verification_status text DEFAULT 'pending'::text,
  max_sessions_per_day integer DEFAULT 8,
  buffer_minutes integer DEFAULT 15,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Therapist weekly availability slots
CREATE TABLE public.therapist_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL, -- 0=Sunday, 6=Saturday
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Sessions (bookings)
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id),
  client_id uuid NOT NULL, -- references auth.users(id) conceptually
  session_type text,
  session_format text,
  scheduled_at timestamp with time zone NOT NULL,
  duration_minutes integer DEFAULT 50,
  status text DEFAULT 'pending'::text,
  price integer,
  currency text DEFAULT 'KES'::text,
  notes_client text,
  cancellation_reason text,
  session_link text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Private therapist notes
CREATE TABLE public.session_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Client reviews of therapists
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id),
  client_id uuid NOT NULL, -- references auth.users(id) conceptually
  session_id uuid REFERENCES public.sessions(id),
  rating integer NOT NULL,
  text text,
  verified boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Client intake questionnaire responses
CREATE TABLE public.intake_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  age_range text,
  gender_identity text,
  presenting_concerns text[] DEFAULT '{}'::text[],
  session_format_preference text[] DEFAULT '{}'::text[],
  language_preference text DEFAULT 'English'::text,
  session_time_preference text,
  frequency_preference text,
  therapist_gender_preference text,
  cultural_background_important boolean DEFAULT false,
  cultural_background text,
  experience_level_preference text,
  specialisation_importance integer DEFAULT 3,
  budget_range text,
  insurance_coverage text,
  sliding_scale_needed boolean DEFAULT false,
  additional_notes text,
  previous_therapy boolean,
  crisis_flag boolean DEFAULT false,
  completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Blog / articles
CREATE TABLE public.articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL DEFAULT ''::text,
  cover_image_url text,
  category text NOT NULL DEFAULT 'general'::text,
  tags text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft'::text,
  author_id uuid NOT NULL,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tiered commission rates
CREATE TABLE public.commission_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_revenue integer NOT NULL DEFAULT 0,
  max_revenue integer,
  commission_rate numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KES'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Platform key-value settings
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);


-- ============================================================
-- 3. FUNCTIONS
-- ============================================================

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Check if a user has a specific role (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile + default 'client' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');

  RETURN NEW;
END;
$$;

-- Prevent non-therapist users from inserting into therapists table
CREATE OR REPLACE FUNCTION public.validate_therapist_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(NEW.user_id, 'therapist') THEN
    RAISE EXCEPTION 'User must have the therapist role to create a therapist profile';
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- Auto-create profile on new auth user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enforce therapist role before insert
CREATE TRIGGER enforce_therapist_role
  BEFORE INSERT ON public.therapists
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_therapist_role();

-- Auto-update updated_at on relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_therapists_updated_at BEFORE UPDATE ON public.therapists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_therapist_availability_updated_at BEFORE UPDATE ON public.therapist_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_intake_responses_updated_at BEFORE UPDATE ON public.intake_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_commission_tiers_updated_at BEFORE UPDATE ON public.commission_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- ---- profiles ----
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- user_roles ----
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- therapists ----
CREATE POLICY "Anyone can view verified therapists" ON public.therapists FOR SELECT USING (verified = true);
CREATE POLICY "Therapists can view own profile" ON public.therapists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Therapists can insert own profile" ON public.therapists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Therapists can update own profile" ON public.therapists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage therapists" ON public.therapists FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- therapist_availability ----
CREATE POLICY "Therapists can manage own availability" ON public.therapist_availability FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM therapists t WHERE t.id = therapist_availability.therapist_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM therapists t WHERE t.id = therapist_availability.therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Anyone can view availability" ON public.therapist_availability FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage availability" ON public.therapist_availability FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- sessions ----
CREATE POLICY "Clients can view own sessions" ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Clients can create sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own sessions" ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Therapists can view own sessions" ON public.sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM therapists t WHERE t.id = sessions.therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Therapists can update own sessions" ON public.sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM therapists t WHERE t.id = sessions.therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Admins can manage sessions" ON public.sessions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- reviews ----
CREATE POLICY "Clients can view own reviews" ON public.reviews FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Clients can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Admins can manage reviews" ON public.reviews FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- intake_responses ----
CREATE POLICY "Users can manage own intake" ON public.intake_responses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view intakes" ON public.intake_responses FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- articles ----
CREATE POLICY "Anyone can view published articles" ON public.articles FOR SELECT USING (status = 'published'::text);
CREATE POLICY "Admins can manage articles" ON public.articles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- commission_tiers ----
CREATE POLICY "Admins can manage commission tiers" ON public.commission_tiers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Therapists can view commission tiers" ON public.commission_tiers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'therapist'::app_role));

-- ---- platform_settings ----
CREATE POLICY "Admins can manage settings" ON public.platform_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);


-- ============================================================
-- 7. STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('article-covers', 'article-covers', true);

-- Storage RLS policies (adjust as needed)
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can view article covers" ON storage.objects FOR SELECT USING (bucket_id = 'article-covers');
CREATE POLICY "Admins can upload article covers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'article-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update article covers" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'article-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete article covers" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'article-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));


-- ============================================================
-- 8. SEED DATA (optional — default commission tiers)
-- ============================================================

INSERT INTO public.commission_tiers (min_revenue, max_revenue, commission_rate, currency) VALUES
  (0, 50000, 20, 'KES'),
  (50001, 150000, 15, 'KES'),
  (150001, NULL, 10, 'KES');

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('terms_version', '"1.0"', 'Current Terms & Conditions version');


-- ============================================================
-- 9. REALTIME (enable if needed)
-- ============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.therapist_availability;
