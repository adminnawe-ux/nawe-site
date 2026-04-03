
-- Platform settings key-value store for global config
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read settings" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (true);

-- Commission tiers table
CREATE TABLE public.commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_revenue integer NOT NULL DEFAULT 0,
  max_revenue integer,
  commission_rate numeric(5,2) NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission tiers" ON public.commission_tiers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Therapists can view commission tiers" ON public.commission_tiers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'therapist'));

-- Add terms_accepted fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN terms_accepted_at timestamptz,
  ADD COLUMN terms_version text;

-- Seed default commission tiers
INSERT INTO public.commission_tiers (min_revenue, max_revenue, commission_rate, currency)
VALUES
  (0, 50000, 20.00, 'KES'),
  (50001, 150000, 15.00, 'KES'),
  (150001, NULL, 10.00, 'KES');

-- Seed default platform setting for T&C version
INSERT INTO public.platform_settings (key, value, description)
VALUES ('terms_version', '"1.0"', 'Current version of Terms & Conditions');
