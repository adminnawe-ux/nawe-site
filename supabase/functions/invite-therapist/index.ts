import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? 'https://nawe.co.ke',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify caller is admin
  const { data: roleRow } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { email: string; first_name: string; last_name?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const firstName = (body.first_name ?? '').trim();
  const lastName = (body.last_name ?? '').trim();

  if (!email || !firstName) {
    return new Response(JSON.stringify({ error: 'email and first_name are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Send Supabase invite email — the BEFORE INSERT trigger on auth.users will
  // copy account_type into app_metadata, which the RLS policy uses to allow
  // the therapist role self-assignment during onboarding.
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: { first_name: firstName, last_name: lastName, account_type: 'therapist' },
      redirectTo: `${appUrl}/therapist-portal/onboarding`,
    },
  );

  if (inviteError) {
    console.error('invite-therapist error:', inviteError.message);
    const msg = inviteError.message?.toLowerCase() ?? '';
    const friendly = msg.includes('already') || msg.includes('registered') || msg.includes('exists')
      ? 'A user with this email address has already been registered.'
      : inviteError.message;
    return new Response(JSON.stringify({ error: friendly }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // The handle_new_user trigger creates the profile automatically, but upsert
  // here ensures the name is set even if the trigger ran before our data arrived.
  if (inviteData.user) {
    await adminClient.from('profiles').upsert(
      { user_id: inviteData.user.id, first_name: firstName, last_name: lastName || null },
      { onConflict: 'user_id' },
    );
  }

  console.log(`Therapist invite sent to ${email} by admin ${userData.user.id}`);

  return new Response(JSON.stringify({ invited: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
