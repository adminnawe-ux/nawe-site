import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface UnsubscribeToken {
  u: string | null; // user_id
  s: string | null; // newsletter_subscribers.id
  e: string; // email, kept for the confirmation page only
}

function decodeUnsubscribeToken(token: string): UnsubscribeToken | null {
  try {
    const parsed = JSON.parse(atob(token));
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.e !== 'string') return null;
    return { u: parsed.u ?? null, s: parsed.s ?? null, e: parsed.e };
  } catch {
    return null;
  }
}

// Called from the public /unsubscribe frontend page (not linked to directly from
// emails), so it goes through supabase-js and the platform's normal JWT gate
// like any other browser-facing function — no --no-verify-jwt needed.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const decoded = decodeUnsubscribeToken(body.token ?? '');
  if (!decoded) {
    return new Response(JSON.stringify({ error: 'This unsubscribe link is invalid or has expired.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (decoded.u) {
      await adminClient.from('profiles').update({ broadcast_opt_out: true }).eq('user_id', decoded.u);
    }
    if (decoded.s) {
      await adminClient.from('newsletter_subscribers').update({ unsubscribed_at: new Date().toISOString() }).eq('id', decoded.s);
    }

    return new Response(JSON.stringify({ unsubscribed: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('unsubscribe-broadcast error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again later.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
