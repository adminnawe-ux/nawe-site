
-- Role enum
CREATE TYPE public.app_role AS ENUM ('client', 'therapist', 'admin');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  location TEXT,
  country TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (secure, separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Therapists table
CREATE TABLE public.therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_title TEXT,
  license_number TEXT,
  issuing_body TEXT,
  years_experience INTEGER,
  bio TEXT,
  tagline TEXT,
  photo_url TEXT,
  video_url TEXT,
  specialisations TEXT[] DEFAULT '{}',
  modalities TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{English}',
  session_formats TEXT[] DEFAULT '{}',
  client_populations TEXT[] DEFAULT '{}',
  cultural_competencies TEXT[] DEFAULT '{}',
  education TEXT,
  price_per_session INTEGER,
  currency TEXT DEFAULT 'KES',
  sliding_scale BOOLEAN DEFAULT false,
  sliding_scale_min INTEGER,
  insurance_accepted TEXT[] DEFAULT '{}',
  cancellation_policy TEXT,
  verified BOOLEAN DEFAULT false,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),
  max_sessions_per_day INTEGER DEFAULT 8,
  buffer_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Intake responses
CREATE TABLE public.intake_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  age_range TEXT,
  gender_identity TEXT,
  presenting_concerns TEXT[] DEFAULT '{}',
  session_format_preference TEXT[] DEFAULT '{}',
  language_preference TEXT DEFAULT 'English',
  session_time_preference TEXT,
  frequency_preference TEXT,
  therapist_gender_preference TEXT,
  cultural_background_important BOOLEAN DEFAULT false,
  cultural_background TEXT,
  experience_level_preference TEXT,
  specialisation_importance INTEGER DEFAULT 3,
  budget_range TEXT,
  insurance_coverage TEXT,
  sliding_scale_needed BOOLEAN DEFAULT false,
  additional_notes TEXT,
  previous_therapy BOOLEAN,
  crisis_flag BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT CHECK (session_type IN ('initial_consultation', 'ongoing', 'couples', 'group')),
  session_format TEXT CHECK (session_format IN ('video', 'phone', 'in_person', 'messaging')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 50,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  price INTEGER,
  currency TEXT DEFAULT 'KES',
  notes_client TEXT,
  notes_therapist TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_therapists_updated_at BEFORE UPDATE ON public.therapists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_intake_responses_updated_at BEFORE UPDATE ON public.intake_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + client role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Therapists
CREATE POLICY "Anyone can view verified therapists" ON public.therapists FOR SELECT USING (verified = true);
CREATE POLICY "Therapists can view own profile" ON public.therapists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Therapists can update own profile" ON public.therapists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Therapists can insert own profile" ON public.therapists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage therapists" ON public.therapists FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Intake responses
CREATE POLICY "Users can manage own intake" ON public.intake_responses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view intakes" ON public.intake_responses FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Sessions
CREATE POLICY "Clients can view own sessions" ON public.sessions FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Therapists can view own sessions" ON public.sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid())
);
CREATE POLICY "Clients can create sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Therapists can update own sessions" ON public.sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid())
);
CREATE POLICY "Admins can manage sessions" ON public.sessions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Reviews
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Clients can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Admins can manage reviews" ON public.reviews FOR ALL USING (public.has_role(auth.uid(), 'admin'));
