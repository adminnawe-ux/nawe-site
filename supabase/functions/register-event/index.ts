import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@nawe.co.ke';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';
const googleServiceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';
const googlePrivateKey = Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '';
const googleCalendarId = Deno.env.get('GOOGLE_CALENDAR_ID') ?? 'primary';
const ncbaBaseUrl = 'https://c2bapis.ncbagroup.com';
const ncbaStkUsername = Deno.env.get('NCBA_STK_USERNAME') ?? '';
const ncbaStkPassword = Deno.env.get('NCBA_STK_PASSWORD') ?? '';
const mpesaPaybill = Deno.env.get('MPESA_PAYBILL') ?? '880100';
const mpesaAccount = Deno.env.get('MPESA_ACCOUNT') ?? mpesaPaybill;

const NCBA_TIMEOUT_MS = 10_000;
let _cachedToken: { value: string; expiresAt: number } | null = null;

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function normaliseMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  return digits;
}

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
  if (!resp.ok) throw new Error(`NCBA token error (${resp.status})`);
  const json = await resp.json();
  if (!json.access_token) throw new Error('NCBA did not return an access_token');
  _cachedToken = { value: json.access_token, expiresAt: Date.now() + 16 * 60 * 60 * 1000 };
  return json.access_token as string;
}

async function getGoogleToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: googleServiceAccountEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  };
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signingInput = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}`;
  const pem = googlePrivateKey.replace(/\\n/g, '\n');
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${signingInput}.${sigB64}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!resp.ok) throw new Error(`Google token error: ${await resp.text()}`);
  const data = await resp.json();
  return data.access_token as string;
}

async function addToCalendar(params: {
  title: string; location: string | null; starts_at: string; ends_at: string | null;
  attendeeEmail: string; ticketCode: string;
}): Promise<string | null> {
  if (!googleServiceAccountEmail || !googlePrivateKey) return null;
  try {
    const token = await getGoogleToken();
    const start = new Date(params.starts_at);
    const end = params.ends_at ? new Date(params.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const body = {
      summary: params.title,
      location: params.location ?? undefined,
      description: `Your ticket code: ${params.ticketCode}\n\nView your ticket: ${appUrl}/events/ticket/${params.ticketCode}`,
      start: { dateTime: start.toISOString(), timeZone: 'Africa/Nairobi' },
      end: { dateTime: end.toISOString(), timeZone: 'Africa/Nairobi' },
      attendees: [{ email: params.attendeeEmail }],
      reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 60 }] },
    };
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events?sendUpdates=all`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) { console.error('Calendar error:', await resp.text()); return null; }
    const event = await resp.json();
    return event.htmlLink as string ?? null;
  } catch (e) {
    console.error('Calendar invite failed (non-fatal):', e);
    return null;
  }
}

async function sendTicketEmail(params: {
  to: string; name: string; eventTitle: string; eventDate: string; eventLocation: string | null;
  ticketCode: string; calendarLink: string | null; isFree: boolean; price: number | null; currency: string;
}) {
  if (!resendApiKey) return;
  const ticketUrl = `${appUrl}/events/ticket/${params.ticketCode}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
      <h2 style="color:#10b981">You're registered! 🎉</h2>
      <p>Hi ${escapeHtml(params.name)},</p>
      <p>Your ${params.isFree ? 'free ' : ''}spot for <strong>${escapeHtml(params.eventTitle)}</strong> is confirmed.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Date</td>
          <td style="padding:10px 14px">${escapeHtml(params.eventDate)}</td>
        </tr>
        ${params.eventLocation ? `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Location</td>
          <td style="padding:10px 14px">${escapeHtml(params.eventLocation)}</td>
        </tr>` : ''}
        ${!params.isFree ? `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Amount paid</td>
          <td style="padding:10px 14px;font-weight:bold">${escapeHtml(params.currency)} ${(params.price ?? 0).toLocaleString()}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Ticket Code</td>
          <td style="padding:10px 14px;font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:3px">${escapeHtml(params.ticketCode)}</td>
        </tr>
      </table>
      <p>
        <a href="${ticketUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          View Your Ticket →
        </a>
      </p>
      ${params.calendarLink ? `<p><a href="${params.calendarLink}" style="color:#10b981">Add to Google Calendar →</a></p>` : ''}
      <p style="color:#6b7280;font-size:13px;margin-top:32px">The Nawe Team · <a href="https://nawe.co.ke" style="color:#10b981">nawe.co.ke</a></p>
    </div>
  `;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to: params.to, subject: `Your ticket — ${params.eventTitle}`, html }),
  });
  if (!resp.ok) console.error('Resend error:', await resp.text());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    userId = userData.user?.id ?? null;
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { event_id: string; attendee_name: string; attendee_email: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { event_id, attendee_name, attendee_email, phone } = body;
  if (!event_id || !attendee_name?.trim() || !attendee_email?.trim()) {
    return new Response(JSON.stringify({ error: 'event_id, attendee_name, and attendee_email are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch event
    const { data: event, error: eventError } = await adminClient
      .from('events').select('*').eq('id', event_id).eq('status', 'published').maybeSingle();
    if (eventError || !event) return new Response(JSON.stringify({ error: 'Event not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // Capacity check
    if (event.capacity) {
      const { count } = await adminClient.from('event_registrations')
        .select('id', { count: 'exact', head: true }).eq('event_id', event_id)
        .in('payment_status', ['free', 'paid', 'pending_stk']);
      if ((count ?? 0) >= event.capacity) return new Response(JSON.stringify({ error: 'This event is sold out.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Duplicate guard
    if (userId) {
      const { data: existing } = await adminClient.from('event_registrations')
        .select('id, ticket_code').eq('event_id', event_id).eq('user_id', userId)
        .in('payment_status', ['free', 'paid']).maybeSingle();
      if (existing) return new Response(JSON.stringify({ error: 'You are already registered for this event.', ticket_code: existing.ticket_code }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (event.is_free) {
      // Create registration immediately
      const { data: reg, error: regError } = await adminClient.from('event_registrations').insert({
        event_id, user_id: userId, attendee_name, attendee_email,
        payment_status: 'free', price_paid: 0,
      }).select('id, ticket_code').single();
      if (regError) throw regError;

      // Calendar invite + confirmation email (best-effort)
      const eventDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi' }).format(new Date(event.starts_at));
      const calendarLink = await addToCalendar({
        title: event.title, location: event.location, starts_at: event.starts_at,
        ends_at: event.ends_at, attendeeEmail: attendee_email, ticketCode: reg.ticket_code,
      });
      await sendTicketEmail({
        to: attendee_email, name: attendee_name, eventTitle: event.title,
        eventDate, eventLocation: event.location, ticketCode: reg.ticket_code,
        calendarLink, isFree: true, price: null, currency: event.currency,
      });

      return new Response(JSON.stringify({ ticket_code: reg.ticket_code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Paid event — validate phone and initiate STK push
    if (!phone) return new Response(JSON.stringify({ error: 'Phone number required for paid events.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    const msisdn = normaliseMsisdn(phone);
    if (!/^2547\d{8}$/.test(msisdn)) return new Response(JSON.stringify({ error: 'Invalid Safaricom number. Use 07XXXXXXXX.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const token = await getNcbaToken();
    const stkResp = await ncbaFetch(`${ncbaBaseUrl}/payments/api/v1/stk-push/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        TelephoneNo: msisdn, Amount: String(event.price ?? 0),
        PayBillNo: mpesaPaybill, AccountNo: mpesaAccount,
        Network: 'Safaricom', TransactionType: 'CustomerPayBillOnline',
      }),
    });
    const stkData = await stkResp.json();
    if (!stkResp.ok || stkData.StatusCode === '1' || !stkData.TransactionID) {
      throw new Error(stkData.StatusDescription ?? 'STK push failed');
    }

    const { data: reg, error: regError } = await adminClient.from('event_registrations').insert({
      event_id, user_id: userId, attendee_name, attendee_email,
      payment_status: 'pending_stk',
      payment_reference: stkData.TransactionID,
      price_paid: event.price,
    }).select('id, ticket_code').single();
    if (regError) throw regError;

    return new Response(JSON.stringify({ registration_id: reg.id, transaction_id: stkData.TransactionID }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('register-event error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
