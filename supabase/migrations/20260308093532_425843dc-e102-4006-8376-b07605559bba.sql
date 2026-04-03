
-- Fix profiles table - all policies are restrictive, need permissive
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix intake_responses
DROP POLICY IF EXISTS "Users can manage own intake" ON public.intake_responses;
DROP POLICY IF EXISTS "Admins can view intakes" ON public.intake_responses;

CREATE POLICY "Users can manage own intake" ON public.intake_responses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view intakes" ON public.intake_responses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix sessions
DROP POLICY IF EXISTS "Clients can view own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Clients can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Therapists can view own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Therapists can update own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins can manage sessions" ON public.sessions;

CREATE POLICY "Clients can view own sessions" ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Clients can create sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Therapists can view own sessions" ON public.sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM therapists t WHERE t.id = sessions.therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Therapists can update own sessions" ON public.sessions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM therapists t WHERE t.id = sessions.therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Admins can manage sessions" ON public.sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix therapists
DROP POLICY IF EXISTS "Anyone can view verified therapists" ON public.therapists;
DROP POLICY IF EXISTS "Therapists can insert own profile" ON public.therapists;
DROP POLICY IF EXISTS "Therapists can update own profile" ON public.therapists;
DROP POLICY IF EXISTS "Therapists can view own profile" ON public.therapists;
DROP POLICY IF EXISTS "Admins can manage therapists" ON public.therapists;

CREATE POLICY "Anyone can view verified therapists" ON public.therapists FOR SELECT USING (verified = true);
CREATE POLICY "Therapists can insert own profile" ON public.therapists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Therapists can update own profile" ON public.therapists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Therapists can view own profile" ON public.therapists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage therapists" ON public.therapists FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Clients can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Clients can update own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;

CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Clients can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Admins can manage reviews" ON public.reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
