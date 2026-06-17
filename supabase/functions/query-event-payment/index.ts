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
const ncbaBaseUrl = 'https://c2bapis.ncbagroup.com';
const ncbaStkUsername = Deno.env.get('NCBA_STK_USERNAME') ?? '';
const ncbaStkPassword = Deno.env.get('NCBA_STK_PASSWORD') ?? '';

const NCBA_TIMEOUT_MS = 10_000;
let _cachedToken: { value: string; expiresAt: number } | null = null;

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

async function ncbaFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NCBA_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function getNcbaToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt) return _cachedToken.value;
  const credentials = btoa(`${ncbaStkUsername}:${ncbaStkPassword}`);
  const resp = await ncbaFetch(`${ncbaBaseUrl}/payments/api/v1/auth/token`, {
    method: 'GET', headers: { Authorization: `Basic ${credentials}` },
  });
  if (!resp.ok) throw new Error(`NCBA token error: ${resp.status}`);
  const json = await resp.json();
  if (!json.access_token) throw new Error('No access_token from NCBA');
  _cachedToken = { value: json.access_token, expiresAt: Date.now() + 16 * 60 * 60 * 1000 };
  return json.access_token as string;
}

interface RegRow {
  id: string;
  ticket_code: string;
  attendee_name: string;
  attendee_email: string;
  price_paid: number | null;
  payment_status: string;
  tier_id: string | null;
  event: {
    title: string; location: string | null; starts_at: string; ends_at: string | null;
    currency: string; google_calendar_id: string | null; google_calendar_event_id: string | null;
  };
}

interface MemberRow {
  id: string;
  ticket_code: string;
  attendee_name: string;
  attendee_email: string;
}

async function confirmPaymentAndNotify(
  adminClient: ReturnType<typeof createClient>,
  lead: RegRow,
  tierName: string | null,
) {
  // Mark lead as paid
  const { data: claimed } = await adminClient.from('event_registrations')
    .update({ payment_status: 'paid' })
    .eq('id', lead.id).eq('payment_status', 'pending_stk')
    .select('id');

  if (!claimed || claimed.length === 0) return; // already handled (e.g. by webhook)

  // Mark all group members as paid
  await adminClient.from('event_registrations')
    .update({ payment_status: 'paid' })
    .eq('group_lead_id', lead.id);

  const { data: members } = await adminClient.from('event_registrations')
    .select('id, ticket_code, attendee_name, attendee_email')
    .eq('group_lead_id', lead.id) as { data: MemberRow[] | null };

  const eventDate = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi',
  }).format(new Date(lead.event.starts_at));

  const sendEmail = async (to: string, name: string, ticketCode: string, isGroupMember: boolean) => {
    if (!resendApiKey) return;
    const ticketUrl = `${appUrl}/events/ticket/${ticketCode}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
        <h2 style="color:#10b981">Payment confirmed — you're in! 🎉</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>${isGroupMember ? 'Your spot as part of a group booking for' : 'Your payment has been received and your spot for'} <strong>${escapeHtml(lead.event.title)}</strong> is confirmed.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Date</td>
            <td style="padding:10px 14px">${escapeHtml(eventDate)}</td>
          </tr>
          ${lead.event.location ? `<tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Location</td>
            <td style="padding:10px 14px">${escapeHtml(lead.event.location)}</td>
          </tr>` : ''}
          ${tierName ? `<tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Ticket type</td>
            <td style="padding:10px 14px">${escapeHtml(tierName)}</td>
          </tr>` : ''}
          ${!isGroupMember ? `<tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Amount paid</td>
            <td style="padding:10px 14px;font-weight:bold">${escapeHtml(lead.event.currency)} ${(lead.price_paid ?? 0).toLocaleString()}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Ticket Code</td>
            <td style="padding:10px 14px;font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:3px">${escapeHtml(ticketCode)}</td>
          </tr>
        </table>
        <p><a href="${ticketUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">View Your Ticket →</a></p>
        <p style="color:#6b7280;font-size:13px;margin-top:32px">The Nawe Team</p>
      </div>`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to, subject: `Payment confirmed — ${lead.event.title}`, html }),
    });
    if (!r.ok) console.error('Resend error:', await r.text());
  };

  const addToCalendar = async (email: string) => {
    if (!lead.event.google_calendar_id || !lead.event.google_calendar_event_id) return;
    try {
      await fetch(`${supabaseUrl}/functions/v1/add-event-guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceRoleKey}` },
        body: JSON.stringify({
          calendar_id: lead.event.google_calendar_id,
          event_id: lead.event.google_calendar_event_id,
          attendee_email: email,
        }),
      });
    } catch (e) { console.error('Calendar guest addition failed:', e); }
  };

  await addToCalendar(lead.attendee_email);
  await sendEmail(lead.attendee_email, lead.attendee_name, lead.ticket_code, false);

  for (const m of (members ?? [])) {
    await addToCalendar(m.attendee_email);
    await sendEmail(m.attendee_email, m.attendee_name, m.ticket_code, true);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  let body: { transaction_id: string; registration_id: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  const { transaction_id, registration_id } = body;
  if (!transaction_id || !registration_id) return new Response(JSON.stringify({ error: 'Missing transaction_id or registration_id' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: lead } = await adminClient
    .from('event_registrations')
    .select('id, ticket_code, payment_status, attendee_name, attendee_email, price_paid, tier_id, event:events(title, location, starts_at, ends_at, currency, google_calendar_id, google_calendar_event_id)')
    .eq('id', registration_id)
    .maybeSingle() as { data: RegRow | null };

  if (!lead) return new Response(JSON.stringify({ error: 'Registration not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  if (lead.payment_status === 'paid') {
    return new Response(JSON.stringify({ status: 'confirmed', ticket_code: lead.ticket_code }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve tier name for email
  let tierName: string | null = null;
  if (lead.tier_id) {
    const { data: tierData } = await adminClient.from('event_ticket_tiers').select('name').eq('id', lead.tier_id).maybeSingle();
    tierName = tierData?.name ?? null;
  }

  try {
    const token = await getNcbaToken();
    const queryResp = await ncbaFetch(`${ncbaBaseUrl}/payments/api/v1/stk-push/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ TransactionID: transaction_id }),
    });
    const queryData = await queryResp.json();
    console.log('Event payment query:', JSON.stringify(queryData));
    const ncbaStatus: string = queryData.status ?? '';

    if (ncbaStatus.toUpperCase() === 'SUCCESS') {
      await confirmPaymentAndNotify(adminClient, lead, tierName);
      return new Response(JSON.stringify({ status: 'confirmed', ticket_code: lead.ticket_code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (ncbaStatus.toUpperCase() === 'FAILED') {
      const description = queryData.description ?? '';
      const isApiError = !description || description.toLowerCase().includes('error') || description.toLowerCase().includes('internal');
      if (!isApiError) {
        // Mark lead + all group members as failed
        await adminClient.from('event_registrations').update({ payment_status: 'failed' }).eq('id', registration_id);
        await adminClient.from('event_registrations').update({ payment_status: 'failed' }).eq('group_lead_id', registration_id);
        return new Response(JSON.stringify({ status: 'failed', reason: description }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ status: 'pending' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'pending' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('query-event-payment error:', err);
    return new Response(JSON.stringify({ status: 'pending' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
