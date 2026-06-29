import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify caller identity
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

  const userId = userData.user.id;

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const { cv_url, ...profileData } = body;

    // Grant therapist role if not already present
    const { data: existingRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'therapist')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await adminClient
        .from('user_roles')
        .insert({ user_id: userId, role: 'therapist' });
      if (roleError) throw roleError;
    }

    // If therapist already has a cv_url, archive it before overwriting
    if (cv_url) {
      const { data: existing } = await adminClient
        .from('therapists')
        .select('id, cv_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing?.cv_url && existing.cv_url !== cv_url) {
        await adminClient.from('therapist_cv_history').insert({
          therapist_id: existing.id,
          cv_url: existing.cv_url,
        });
      }
    }

    // Upsert therapist record
    const { error: therapistError } = await adminClient
      .from('therapists')
      .upsert(
        {
          user_id: userId,
          ...profileData,
          cv_url: cv_url ?? null,
          verification_status: 'pending',
          verified: false,
        },
        { onConflict: 'user_id' }
      );
    if (therapistError) throw therapistError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submit-therapist-onboarding error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
