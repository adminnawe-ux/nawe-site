-- Events and registrations

CREATE TABLE IF NOT EXISTS public.events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  title            text NOT NULL,
  description      text,
  poster_url       text,
  organizer_name   text,
  location         text,
  location_url     text,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz,
  is_free          boolean NOT NULL DEFAULT true,
  price            numeric,
  currency         text NOT NULL DEFAULT 'KES',
  capacity         integer, -- null = unlimited
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attendee_name       text NOT NULL,
  attendee_email      text NOT NULL,
  ticket_code         text NOT NULL UNIQUE DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  payment_status      text NOT NULL DEFAULT 'free'
                      CHECK (payment_status IN ('free', 'pending_stk', 'paid', 'failed')),
  payment_reference   text,
  price_paid          numeric,
  checked_in          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_registrations_event_id_idx ON public.event_registrations (event_id);
CREATE INDEX IF NOT EXISTS event_registrations_ticket_code_idx ON public.event_registrations (ticket_code);
CREATE INDEX IF NOT EXISTS event_registrations_payment_reference_idx ON public.event_registrations (payment_reference);
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_user_event_idx ON public.event_registrations (user_id, event_id) WHERE user_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER event_registrations_updated_at BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can read published events
CREATE POLICY "Published events are public"
  ON public.events FOR SELECT
  USING (status = 'published');

-- Admins can do everything on events
CREATE POLICY "Admins manage events"
  ON public.events FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Users can read their own registrations; ticket page uses ticket_code (handled in edge function with service role)
CREATE POLICY "Users read own registrations"
  ON public.event_registrations FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all registrations
CREATE POLICY "Admins read all registrations"
  ON public.event_registrations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
