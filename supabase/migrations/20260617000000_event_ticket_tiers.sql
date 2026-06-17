-- Ticket tiers per event (early bird, regular, group, category-restricted, etc.)
CREATE TABLE IF NOT EXISTS public.event_ticket_tiers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name           text NOT NULL,                        -- "Early Bird", "Regular", "Men Only", "Group of 4"
  ticket_type    text NOT NULL DEFAULT 'individual'
                 CHECK (ticket_type IN ('individual', 'group')),
  group_size     integer,                              -- required when ticket_type = 'group'
  price          numeric NOT NULL DEFAULT 0,
  currency       text NOT NULL DEFAULT 'KES',
  capacity       integer,                              -- null = no tier-level cap (still bound by event capacity)
  sale_starts_at timestamptz,                          -- null = available immediately
  sale_ends_at   timestamptz,                          -- null = available until event ends (midnight event day)
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_size_required CHECK (ticket_type != 'group' OR group_size IS NOT NULL),
  CONSTRAINT group_size_positive CHECK (group_size IS NULL OR group_size >= 2)
);

CREATE INDEX IF NOT EXISTS event_ticket_tiers_event_id_idx ON public.event_ticket_tiers (event_id);

-- RLS
ALTER TABLE public.event_ticket_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read tiers for published events
CREATE POLICY "Tiers are public for published events"
  ON public.event_ticket_tiers FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'published')
  );

-- Admins manage tiers
CREATE POLICY "Admins manage tiers"
  ON public.event_ticket_tiers FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Add tier + group columns to event_registrations
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.event_ticket_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_lead_id uuid REFERENCES public.event_registrations(id) ON DELETE CASCADE;

-- group members should not themselves be leads — checked application-side
CREATE INDEX IF NOT EXISTS event_registrations_tier_id_idx ON public.event_registrations (tier_id);
CREATE INDEX IF NOT EXISTS event_registrations_group_lead_id_idx ON public.event_registrations (group_lead_id);
