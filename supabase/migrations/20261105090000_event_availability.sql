-- Public availability counts for an event page.
--
-- RLS on event_registrations only lets a user see their own rows (admins see
-- all), so counting rows from the browser under-reports for everyone else and
-- returns 0 for signed-out visitors. This returns counts only — no attendee
-- data — for published events.
--
-- Statuses must match ACTIVE_STATUSES in supabase/functions/register-event.
CREATE OR REPLACE FUNCTION public.get_event_availability(p_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', (
      SELECT count(*) FROM public.event_registrations r
      WHERE r.event_id = p_event_id
        AND r.payment_status IN ('free', 'paid', 'pending_stk', 'approved_waitlist')
    ),
    'tiers', COALESCE((
      SELECT jsonb_object_agg(t.tier_id, t.n) FROM (
        SELECT r.tier_id, count(*) AS n FROM public.event_registrations r
        WHERE r.event_id = p_event_id
          AND r.tier_id IS NOT NULL
          AND r.payment_status IN ('free', 'paid', 'pending_stk', 'approved_waitlist')
        GROUP BY r.tier_id
      ) t
    ), '{}'::jsonb)
  )
  WHERE EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.status = 'published');
$$;

REVOKE ALL ON FUNCTION public.get_event_availability(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_availability(uuid) TO anon, authenticated;
