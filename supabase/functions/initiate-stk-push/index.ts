import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const appOrigin = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';
const corsHeaders = {
  'Access-Control-Allow-Origin': appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ncbaBaseUrl = 'https://c2bapis.ncbagroup.com';
const ncbaStkUsername = Deno.env.get('NCBA_STK_USERNAME') ?? '';
const ncbaStkPassword = Deno.env.get('NCBA_STK_PASSWORD') ?? '';
const mpesaPaybill = Deno.env.get('MPESA_PAYBILL') ?? '880100';
const mpesaAccount = Deno.env.get('MPESA_ACCOUNT') ?? mpesaPaybill;

interface RequestPayload {
  phone: string;
  therapist_id: string;
  client_id: string;
  scheduled_at: string;
  session_format: string;
  duration_minutes: number;
  notes_client?: string | null;
}

const NCBA_TIMEOUT_MS = 10_000;
const STK_RATE_LIMIT_PER_HOUR = 3;

// In-memory token cache — valid across requests in the same function instance
let _cachedToken: { value: string; expiresAt: number } | null = null;

async function ncbaFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NCBA_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getNcbaToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt) return _cachedToken.value;
  const credentials = btoa(`${ncbaStkUsername}:${ncbaStkPassword}`);
  const resp = await ncbaFetch(`${ncbaBaseUrl}/payments/api/v1/auth/token`, {
    method: 'GET',
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`NCBA token error (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  if (!json.access_token) throw new Error('NCBA did not return an access_token');
  // Cache for 16 hours (token valid 18h — leave 2h buffer)
  _cachedToken = { value: json.access_token, expiresAt: Date.now() + 16 * 60 * 60 * 1000 };
  return json.access_token as string;
}

function normaliseMsisdn(raw: string): string {
  // Accept 07XX, +2547XX, 2547XX → return 2547XX
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
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

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { phone, therapist_id, client_id, scheduled_at, session_format, duration_minutes, notes_client } = payload;

  if (!phone || !therapist_id || !client_id || !scheduled_at || !session_format) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (userData.user.id !== client_id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const msisdn = normaliseMsisdn(phone);
  if (!/^2547\d{8}$/.test(msisdn)) {
    return new Response(JSON.stringify({ error: 'Invalid Kenyan phone number. Use format 07XXXXXXXX or +2547XXXXXXXX.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Fetch price from DB — never trust the client-supplied amount
    const { data: therapist, error: therapistError } = await adminClient
      .from('therapists')
      .select('price_per_session, currency')
      .eq('id', therapist_id)
      .maybeSingle();

    if (therapistError || !therapist) {
      return new Response(JSON.stringify({ error: 'Therapist not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amount = therapist.price_per_session ?? 0;
    const currency = therapist.currency ?? 'KES';

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'Therapist has no price set' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Rate limit — max 3 STK initiations per user per hour
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await adminClient
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client_id)
      .eq('payment_status', 'pending_stk')
      .gte('created_at', since);

    if ((recentCount ?? 0) >= STK_RATE_LIMIT_PER_HOUR) {
      return new Response(JSON.stringify({ error: 'Too many payment attempts. Please wait before trying again.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' },
      });
    }

    // Expire orphaned pending_stk sessions older than 2 minutes (STK prompt expires ~30s)
    const expiryCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await adminClient
      .from('sessions')
      .update({ payment_status: 'failed' })
      .eq('client_id', client_id)
      .eq('payment_status', 'pending_stk')
      .lt('created_at', expiryCutoff);

    // 4. Duplicate guard — reject if an active pending session already exists for this slot
    const { data: existing } = await adminClient
      .from('sessions')
      .select('id')
      .eq('client_id', client_id)
      .eq('therapist_id', therapist_id)
      .eq('scheduled_at', scheduled_at)
      .in('payment_status', ['pending_stk', 'pending_verification', 'paid'])
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: 'A session for this slot is already in progress.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Get NCBA auth token
    const token = await getNcbaToken();

    // 6. Initiate STK push
    const stkResp = await ncbaFetch(`${ncbaBaseUrl}/payments/api/v1/stk-push/initiate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        TelephoneNo: msisdn,
        Amount: String(amount),
        PayBillNo: mpesaPaybill,
        AccountNo: mpesaAccount,
        Network: 'Safaricom',
        TransactionType: 'CustomerPayBillOnline',
      }),
    });

    const stkData = await stkResp.json();
    console.log('STK initiate:', stkData.StatusCode, stkData.StatusDescription);

    if (!stkResp.ok || stkData.StatusCode === '1' || !stkData.TransactionID) {
      const reason = stkData.StatusDescription ?? stkData.message ?? 'STK push failed';
      return new Response(JSON.stringify({ error: reason }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transactionId: string = stkData.TransactionID;

    // 7. Create session with pending_stk status
    const { data: session, error: insertError } = await adminClient
      .from('sessions')
      .insert({
        therapist_id,
        client_id,
        scheduled_at,
        session_format,
        duration_minutes: duration_minutes ?? 50,
        price: amount,
        currency,
        status: 'pending',
        notes_client: notes_client ?? null,
        payment_reference: transactionId,
        payment_status: 'pending_stk',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Session insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Could not create session. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ session_id: session.id, transaction_id: transactionId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('initiate-stk-push error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
