import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  let body: { ticket_code: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  const { ticket_code } = body;
  if (!ticket_code) return new Response(JSON.stringify({ error: 'ticket_code required' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: reg } = await adminClient
    .from('event_registrations')
    .select('ticket_code, attendee_name, attendee_email, payment_status, price_paid, event:events(id, title, slug, poster_url, organizer_name, location, location_url, starts_at, ends_at, is_free, price, currency)')
    .eq('ticket_code', ticket_code)
    .maybeSingle();

  if (!reg) return new Response(JSON.stringify({ error: 'Ticket not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  return new Response(JSON.stringify({ ticket: reg }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
