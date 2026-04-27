import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NCBA_BASE_URL = Deno.env.get('NCBA_BASE_URL') ?? 'https://api.ncbagroup.com';
const NCBA_API_KEY = Deno.env.get('NCBA_API_KEY') ?? '';
const NCBA_USERNAME = Deno.env.get('NCBA_USERNAME') ?? '';
const NCBA_PASSWORD = Deno.env.get('NCBA_PASSWORD') ?? '';
const NCBA_ACCOUNT_NUMBER = Deno.env.get('NCBA_ACCOUNT_NUMBER') ?? '';
const NCBA_COUNTRY_CODE = Deno.env.get('NCBA_COUNTRY_CODE') ?? 'KE';

interface MiniStatementEntry {
  date: string;
  description: string;
  amount: number;
  type: string;   // 'CREDIT' | 'DEBIT'
  balance: number;
}

interface RequestPayload {
  payment_reference: string;
  expected_amount: number;
  currency: string;
  therapist_id: string;
  client_id: string;
  scheduled_at: string;
  session_format: string;
  duration_minutes: number;
  notes_client?: string | null;
}

async function getNCBAToken(): Promise<string> {
  const resp = await fetch(`${NCBA_BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: NCBA_API_KEY,
      username: NCBA_USERNAME,
      password: NCBA_PASSWORD,
    }),
  });

  if (!resp.ok) {
    throw new Error(`NCBA auth failed: ${resp.status} ${await resp.text()}`);
  }

  const { token } = await resp.json();
  if (!token) throw new Error('NCBA auth response missing token');
  return token;
}

async function getMiniStatement(token: string): Promise<MiniStatementEntry[]> {
  const url = `${NCBA_BASE_URL}/accounts/${NCBA_COUNTRY_CODE}/${NCBA_ACCOUNT_NUMBER}/mini-statement`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    throw new Error(`NCBA mini-statement failed: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

function findMatchingTransaction(
  entries: MiniStatementEntry[],
  paymentReference: string,
  expectedAmount: number,
): MiniStatementEntry | null {
  const ref = paymentReference.toUpperCase();
  for (const entry of entries) {
    if (entry.type?.toUpperCase() !== 'CREDIT') continue;
    if (!entry.description?.toUpperCase().includes(ref)) continue;
    // Allow up to 1 KES tolerance for rounding differences
    if (Math.abs(entry.amount - expectedAmount) > 1) continue;
    return entry;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    payment_reference, expected_amount, currency,
    therapist_id, client_id, scheduled_at, session_format,
    duration_minutes, notes_client,
  } = payload;

  if (!payment_reference || !expected_amount || !therapist_id || !client_id || !scheduled_at) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify payment with NCBA
    const token = await getNCBAToken();
    const entries = await getMiniStatement(token);
    const match = findMatchingTransaction(entries, payment_reference, expected_amount);

    if (!match) {
      return new Response(
        JSON.stringify({ verified: false, message: 'Payment not found. Please wait a moment and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Payment confirmed — create the session
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: session, error: insertError } = await supabase
      .from('sessions')
      .insert({
        therapist_id,
        client_id,
        scheduled_at,
        session_format,
        duration_minutes,
        price: expected_amount,
        currency: currency ?? 'KES',
        status: 'pending',
        notes_client: notes_client ?? null,
        payment_reference,
        payment_status: 'paid',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Session insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Payment verified but session creation failed. Contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ verified: true, session_id: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('verify-payment error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
