import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const appOrigin = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';
const corsHeaders = {
  'Access-Control-Allow-Origin': appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@nawe.co.ke';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

const ncbaBaseUrl = 'https://c2bapis.ncbagroup.com';
const ncbaStkUsername = Deno.env.get('NCBA_STK_USERNAME') ?? '';
const ncbaStkPassword = Deno.env.get('NCBA_STK_PASSWORD') ?? '';

const DEFAULT_COMMISSION_RATE = 0.20;
const NCBA_TIMEOUT_MS = 10_000;

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
  if (!resp.ok) throw new Error(`NCBA token error: ${resp.status}`);
  const json = await resp.json();
  if (!json.access_token) throw new Error('No access_token from NCBA');
  _cachedToken = { value: json.access_token, expiresAt: Date.now() + 16 * 60 * 60 * 1000 };
  return json.access_token as string;
}

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi',
  }).format(new Date(value));
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendApiKey || !to) return;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });
  if (!resp.ok) console.error('Resend error:', await resp.text());
}

async function confirmSession(adminClient: ReturnType<typeof createClient>, sessionId: string) {
  const { data: session, error } = await adminClient
    .from('sessions')
    .select('id, client_id, therapist_id, price, currency, scheduled_at, session_format, payment_status')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !session) throw new Error('Session not found');
  if (session.payment_status === 'paid') return; // already confirmed (webhook beat us to it)

  const price = session.price ?? 0;
  const currency = session.currency ?? 'KES';

  const { data: tiers } = await adminClient
    .from('commission_tiers')
    .select('commission_rate')
    .eq('currency', currency)
    .order('min_revenue', { ascending: true });

  const commissionRate = tiers?.[0]?.commission_rate ?? DEFAULT_COMMISSION_RATE;
  const platformCommission = Math.round(price * commissionRate);
  const therapistPayout = price - platformCommission;
  const commissionPct = Math.round(commissionRate * 100);

  const { error: updateError } = await adminClient
    .from('sessions')
    .update({ payment_status: 'paid', status: 'confirmed', therapist_payout: therapistPayout, platform_commission: platformCommission })
    .eq('id', session.id);

  if (updateError) throw new Error('Failed to update session');

  // Fetch names and emails for confirmation emails
  const [{ data: clientProfile }, { data: therapist }] = await Promise.all([
    adminClient.from('profiles').select('first_name, last_name').eq('user_id', session.client_id).maybeSingle(),
    adminClient.from('therapists').select('user_id, professional_title').eq('id', session.therapist_id).maybeSingle(),
  ]);

  const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(' ') || 'Client';
  let therapistName = 'Your therapist';
  let therapistEmail = '';

  if (therapist?.user_id) {
    const [{ data: tp }, { data: tAuth }] = await Promise.all([
      adminClient.from('profiles').select('first_name, last_name').eq('user_id', therapist.user_id).maybeSingle(),
      adminClient.auth.admin.getUserById(therapist.user_id),
    ]);
    therapistName = [tp?.first_name, tp?.last_name].filter(Boolean).join(' ') || therapist.professional_title || 'Your therapist';
    therapistEmail = tAuth.data.user?.email ?? '';
  }

  const { data: clientAuth } = await adminClient.auth.admin.getUserById(session.client_id);
  const clientEmail = clientAuth.user?.email ?? '';
  const formattedDate = formatDate(session.scheduled_at);

  if (clientEmail) {
    await sendEmail(clientEmail, 'Your Nawe session is confirmed', `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
        <h2 style="color:#10b981">Payment received — session confirmed!</h2>
        <p>Hi ${escapeHtml(clientName)},</p>
        <p>Your M-Pesa payment has been received and your session with <strong>${escapeHtml(therapistName)}</strong> is confirmed.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Therapist</td>
            <td style="padding:10px 14px">${escapeHtml(therapistName)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Date &amp; Time</td>
            <td style="padding:10px 14px">${escapeHtml(formattedDate)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Format</td>
            <td style="padding:10px 14px">${escapeHtml(session.session_format ?? '')}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Amount paid</td>
            <td style="padding:10px 14px;font-weight:bold">${escapeHtml(currency)} ${price.toLocaleString()}</td>
          </tr>
        </table>
        <p><a href="${appUrl}/dashboard" style="color:#10b981">View your dashboard →</a></p>
      </div>
    `);
  }

  if (therapistEmail) {
    await sendEmail(therapistEmail, `Confirmed session — ${escapeHtml(clientName)}`, `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
        <h2 style="color:#10b981">New confirmed session</h2>
        <p>Hi ${escapeHtml(therapistName)},</p>
        <p>Payment received for session with <strong>${escapeHtml(clientName)}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Client</td>
            <td style="padding:10px 14px">${escapeHtml(clientName)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Date &amp; Time</td>
            <td style="padding:10px 14px">${escapeHtml(formattedDate)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Session fee</td>
            <td style="padding:10px 14px">${escapeHtml(currency)} ${price.toLocaleString()}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Platform fee (${commissionPct}%)</td>
            <td style="padding:10px 14px;color:#ef4444">− ${escapeHtml(currency)} ${platformCommission.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Your payout</td>
            <td style="padding:10px 14px;font-size:18px;font-weight:bold;color:#10b981">${escapeHtml(currency)} ${therapistPayout.toLocaleString()}</td>
          </tr>
        </table>
        <p><a href="${appUrl}/therapist-portal/calendar" style="color:#10b981">View your calendar →</a></p>
      </div>
    `);
  }
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

  let body: { transaction_id: string; session_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { transaction_id, session_id } = body;
  if (!transaction_id || !session_id) {
    return new Response(JSON.stringify({ error: 'Missing transaction_id or session_id' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Check current session status first — avoid hitting NCBA if already confirmed
  const { data: sessionCheck } = await adminClient
    .from('sessions')
    .select('payment_status, client_id')
    .eq('id', session_id)
    .maybeSingle();

  if (!sessionCheck) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Security: only the session owner can poll
  if (sessionCheck.client_id !== userData.user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (sessionCheck.payment_status === 'paid') {
    return new Response(
      JSON.stringify({ status: 'confirmed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const token = await getNcbaToken();
    const queryResp = await ncbaFetch(`${ncbaBaseUrl}/payments/api/v1/stk-push/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ TransactionID: transaction_id }),
    });

    const queryData = await queryResp.json();
    console.log('STK query response:', JSON.stringify(queryData));

    const ncbaStatus: string = queryData.status ?? '';

    if (ncbaStatus.toUpperCase() === 'SUCCESS') {
      await confirmSession(adminClient, session_id);
      return new Response(
        JSON.stringify({ status: 'confirmed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (ncbaStatus.toUpperCase() === 'FAILED') {
      await adminClient.from('sessions').update({ payment_status: 'failed' }).eq('id', session_id);
      return new Response(
        JSON.stringify({ status: 'failed', reason: queryData.description ?? 'Payment failed or was cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Still pending
    return new Response(
      JSON.stringify({ status: 'pending' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('query-stk-push error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
