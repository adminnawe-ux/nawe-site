import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Returns a client's email for a therapist, scoped to clients they actually
// have a paid session with — the same scoping as the "Therapists can view
// profiles of their paid-session clients" RLS policy on `profiles`, which
// already covers first_name/last_name/phone directly. Email lives in
// auth.users, which isn't exposed via PostgREST/RLS at all, so it needs a
// service-role lookup gated by the same check.

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let clientIds: string[];
  try {
    const body = await req.json();
    clientIds = Array.isArray(body.client_ids) ? body.client_ids.filter((v: unknown) => typeof v === 'string') : [];
    if (clientIds.length === 0) throw new Error('client_ids required');
  } catch {
    return new Response(JSON.stringify({ error: 'client_ids (array) required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: therapist } = await adminClient
    .from('therapists')
    .select('id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!therapist) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Only return emails for clients this therapist actually has a paid session with.
  const { data: sessions } = await adminClient
    .from('sessions')
    .select('client_id')
    .eq('therapist_id', therapist.id)
    .eq('payment_status', 'paid')
    .in('client_id', clientIds);

  const verifiedIds = [...new Set((sessions ?? []).map((s) => s.client_id))];

  const emails: Record<string, string> = {};
  await Promise.all(verifiedIds.map(async (id) => {
    const { data } = await adminClient.auth.admin.getUserById(id);
    if (data.user?.email) emails[id] = data.user.email;
  }));

  return new Response(JSON.stringify({ emails }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
