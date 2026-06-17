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
const mpesaPaybill = Deno.env.get('MPESA_PAYBILL') ?? '880100';
const mpesaAccount = Deno.env.get('MPESA_ACCOUNT') ?? mpesaPaybill;

const NCBA_TIMEOUT_MS = 10_000;
let _cachedToken: { value: string; expiresAt: number } | null = null;

// Active statuses that count toward capacity and duplicate detection
const ACTIVE_STATUSES = ['free', 'paid', 'pending_stk', 'approved_waitlist'];

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

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendApiKey) return;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });
  if (!resp.ok) console.error('Resend error:', await resp.text());
}

async function sendTicketEmail(params: {
  to: string; name: string; eventTitle: string; eventDate: string; eventLocation: string | null;
  ticketCode: string; tierName: string | null; isFree: boolean; price: number | null; currency: string;
  isGroupMember?: boolean;
}) {
  const ticketUrl = `${appUrl}/events/ticket/${params.ticketCode}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
      <h2 style="color:#10b981">You're registered! 🎉</h2>
      <p>Hi ${escapeHtml(params.name)},</p>
      <p>${params.isGroupMember ? 'Your spot as part of a group booking for' : 'Your spot for'} <strong>${escapeHtml(params.eventTitle)}</strong> is confirmed.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Date</td>
          <td style="padding:10px 14px">${escapeHtml(params.eventDate)}</td>
        </tr>
        ${params.eventLocation ? `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Location</td>
          <td style="padding:10px 14px">${escapeHtml(params.eventLocation)}</td>
        </tr>` : ''}
        ${params.tierName ? `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Ticket type</td>
          <td style="padding:10px 14px">${escapeHtml(params.tierName)}</td>
        </tr>` : ''}
        ${!params.isFree && !params.isGroupMember ? `<tr style="border-bottom:1px solid #e5e7eb">
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
      <p style="color:#6b7280;font-size:13px;margin-top:32px">The Nawe Team · <a href="https://nawe.co.ke" style="color:#10b981">nawe.co.ke</a></p>
    </div>
  `;
  await sendEmail(params.to, `Your ticket — ${params.eventTitle}`, html);
}

async function sendWaitlistEmail(params: {
  to: string; name: string; eventTitle: string; eventDate: string; eventLocation: string | null;
}) {
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
      <h2 style="color:#f59e0b">You're on the waitlist</h2>
      <p>Hi ${escapeHtml(params.name)},</p>
      <p>The event <strong>${escapeHtml(params.eventTitle)}</strong> is currently at capacity, but we've added you to the waitlist.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Date</td>
          <td style="padding:10px 14px">${escapeHtml(params.eventDate)}</td>
        </tr>
        ${params.eventLocation ? `<tr>
          <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Location</td>
          <td style="padding:10px 14px">${escapeHtml(params.eventLocation)}</td>
        </tr>` : ''}
      </table>
      <p>We'll email you if a spot opens up and the organiser approves your entry. No action needed for now.</p>
      <p style="color:#6b7280;font-size:13px;margin-top:32px">The Nawe Team · <a href="https://nawe.co.ke" style="color:#10b981">nawe.co.ke</a></p>
    </div>
  `;
  await sendEmail(params.to, `Waitlist confirmed — ${params.eventTitle}`, html);
}

async function addToCalendar(eventData: { google_calendar_id: string | null; google_calendar_event_id: string | null }, attendeeEmail: string) {
  if (!eventData.google_calendar_id || !eventData.google_calendar_event_id) return;
  try {
    await fetch(`${supabaseUrl}/functions/v1/add-event-guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceRoleKey}` },
      body: JSON.stringify({
        calendar_id: eventData.google_calendar_id,
        event_id: eventData.google_calendar_event_id,
        attendee_email: attendeeEmail,
      }),
    });
  } catch (e) { console.error('Failed to add guest to calendar:', e); }
}

// Tier-level date gates only — capacity is handled at event level for waitlist purposes.
// Returns error string if tier date gate fails, null if OK.
function checkTierDateGate(
  tier: { sale_starts_at: string | null; sale_ends_at: string | null },
  now: Date,
): string | null {
  if (tier.sale_starts_at && now < new Date(tier.sale_starts_at)) {
    return 'This ticket tier is not on sale yet.';
  }
  if (tier.sale_ends_at && now > new Date(tier.sale_ends_at)) {
    return 'This ticket tier is no longer available.';
  }
  return null;
}

interface AttendeeInput {
  name: string;
  email: string;
}

interface RequestBody {
  event_id: string;
  tier_id?: string;
  attendee_name: string;
  attendee_email: string;
  phone?: string;
  quantity?: number;
  group_members?: AttendeeInput[];
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

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { event_id, tier_id, attendee_name, attendee_email, phone, group_members } = body;
  const quantity = Math.max(1, Math.min(10, Math.floor(body.quantity ?? 1)));
  if (!event_id || !attendee_name?.trim() || !attendee_email?.trim()) {
    return new Response(JSON.stringify({ error: 'event_id, attendee_name, and attendee_email are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { data: event, error: eventError } = await adminClient
      .from('events').select('*').eq('id', event_id).eq('status', 'published').maybeSingle();
    if (eventError || !event) return new Response(JSON.stringify({ error: 'Event not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const now = new Date();

    // Fetch tier if provided and validate date gates (hard errors — not waivable by waitlist)
    let tier: {
      id: string; name: string; ticket_type: string; group_size: number | null;
      price: number; currency: string; capacity: number | null;
      sale_starts_at: string | null; sale_ends_at: string | null;
    } | null = null;

    if (tier_id) {
      const { data: tierData } = await adminClient
        .from('event_ticket_tiers').select('*').eq('id', tier_id).eq('event_id', event_id).maybeSingle();
      if (!tierData) return new Response(JSON.stringify({ error: 'Ticket tier not found.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      tier = tierData;

      const dateErr = checkTierDateGate(tier, now);
      if (dateErr) return new Response(JSON.stringify({ error: dateErr }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      // Tier-level capacity is a hard cap (waitlist is event-level)
      if (tier.capacity !== null) {
        const { count: tierSold } = await adminClient
          .from('event_registrations').select('id', { count: 'exact', head: true })
          .eq('tier_id', tier_id).in('payment_status', ACTIVE_STATUSES);
        const remaining = tier.capacity - (tierSold ?? 0);
        if (remaining <= 0) return new Response(JSON.stringify({ error: 'This ticket tier is sold out.' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        if (quantity > remaining) return new Response(JSON.stringify({
          error: `Only ${remaining} spot${remaining === 1 ? '' : 's'} left in this tier.`,
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── approved_waitlist fast-path ───────────────────────────────────────────
    // If the user was approved from the waitlist on a paid event, they already
    // have a registration row. Skip the duplicate guard and go straight to payment.
    let approvedWaitlistRow: { id: string; ticket_code: string } | null = null;
    if (userId) {
      const { data: awRow } = await adminClient.from('event_registrations')
        .select('id, ticket_code').eq('event_id', event_id).eq('user_id', userId)
        .eq('payment_status', 'approved_waitlist').maybeSingle();
      if (awRow) approvedWaitlistRow = awRow;
    }

    if (!approvedWaitlistRow) {
      // ── Normal duplicate guard ────────────────────────────────────────────
      if (userId) {
        const { data: existing } = await adminClient.from('event_registrations')
          .select('id, ticket_code, payment_status').eq('event_id', event_id).eq('user_id', userId)
          .in('payment_status', [...ACTIVE_STATUSES, 'waitlisted']).maybeSingle();
        if (existing) {
          if (existing.payment_status === 'waitlisted') {
            // If capacity has since opened (or is unlimited), drop the stale waitlisted
            // row and let the normal flow create a fresh registration.
            let capacityStillFull = false;
            if (event.capacity) {
              const { count: activeCount } = await adminClient.from('event_registrations')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', event_id).in('payment_status', ACTIVE_STATUSES);
              capacityStillFull = (activeCount ?? 0) >= event.capacity;
            }
            if (capacityStillFull) {
              return new Response(JSON.stringify({ error: 'You are already on the waitlist for this event.' }), {
                status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            await adminClient.from('event_registrations').delete().eq('id', existing.id);
            // Fall through to normal registration below
          } else {
            return new Response(JSON.stringify({ error: 'You are already registered for this event.', ticket_code: existing.ticket_code }), {
              status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }

      // ── Event capacity check — waitlist if full ───────────────────────────
      if (event.capacity) {
        const { count } = await adminClient.from('event_registrations')
          .select('id', { count: 'exact', head: true }).eq('event_id', event_id)
          .in('payment_status', ACTIVE_STATUSES);

        if ((count ?? 0) >= event.capacity) {
          // Create waitlisted row (no payment)
          const { error: wlErr } = await adminClient.from('event_registrations').insert({
            event_id, user_id: userId,
            attendee_name: attendee_name.trim(), attendee_email: attendee_email.trim(),
            tier_id: tier_id ?? null,
            payment_status: 'waitlisted',
            price_paid: 0,
          });
          if (wlErr) throw wlErr;

          const eventDate = new Intl.DateTimeFormat('en-GB', {
            dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi',
          }).format(new Date(event.starts_at));

          await sendWaitlistEmail({
            to: attendee_email.trim(), name: attendee_name.trim(),
            eventTitle: event.title, eventDate, eventLocation: event.location,
          });

          return new Response(JSON.stringify({ waitlisted: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // ── Group member / multi-ticket validation ────────────────────────────────
    const isGroupTier = tier?.ticket_type === 'group';
    // Group tier: extra members = group_size - 1 (fixed)
    // Individual tier with quantity > 1: extra members = quantity - 1
    const expectedMembers = isGroupTier ? (tier!.group_size! - 1) : (quantity - 1);
    if (expectedMembers > 0 && (!group_members || group_members.length !== expectedMembers)) {
      return new Response(JSON.stringify({
        error: isGroupTier
          ? `This is a group ticket for ${tier!.group_size} people. Please provide details for all ${expectedMembers} additional members.`
          : `Please provide details for all ${expectedMembers} additional ${expectedMembers === 1 ? 'attendee' : 'attendees'}.`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (isGroupTier && group_members) {
      for (const m of group_members) {
        if (!m.name?.trim() || !m.email?.trim() || !m.email.includes('@')) {
          return new Response(JSON.stringify({ error: 'Each group member must have a valid name and email.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const effectivePrice = tier ? tier.price : (event.is_free ? 0 : (event.price ?? 0));
    const isFree = effectivePrice === 0;
    const currency = tier?.currency ?? event.currency;
    const tierName = tier?.name ?? null;

    const eventDate = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi',
    }).format(new Date(event.starts_at));

    // ── Free registration ─────────────────────────────────────────────────────
    if (isFree) {
      const { data: leadReg, error: regError } = await adminClient.from('event_registrations').insert({
        event_id, user_id: userId, attendee_name: attendee_name.trim(), attendee_email: attendee_email.trim(),
        tier_id: tier_id ?? null, payment_status: 'free', price_paid: 0,
      }).select('id, ticket_code').single();
      if (regError) throw regError;

      if (group_members && group_members.length > 0) {
        for (const m of group_members) {
          await adminClient.from('event_registrations').insert({
            event_id, user_id: null,
            attendee_name: m.name.trim(), attendee_email: m.email.trim(),
            tier_id: tier_id ?? null, group_lead_id: leadReg.id,
            payment_status: 'free', price_paid: 0,
          });
        }
      }

      const { data: memberRows } = expectedMembers > 0
        ? await adminClient.from('event_registrations')
            .select('id, ticket_code, attendee_name, attendee_email').eq('group_lead_id', leadReg.id)
        : { data: [] };

      await addToCalendar(event, attendee_email.trim());
      await sendTicketEmail({
        to: attendee_email.trim(), name: attendee_name.trim(), eventTitle: event.title,
        eventDate, eventLocation: event.location, ticketCode: leadReg.ticket_code,
        tierName, isFree: true, price: null, currency,
      });
      for (const m of (memberRows ?? [])) {
        await addToCalendar(event, m.attendee_email);
        await sendTicketEmail({
          to: m.attendee_email, name: m.attendee_name, eventTitle: event.title,
          eventDate, eventLocation: event.location, ticketCode: m.ticket_code,
          tierName, isFree: true, price: null, currency, isGroupMember: true,
        });
      }

      return new Response(JSON.stringify({ ticket_code: leadReg.ticket_code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Paid registration (including approved_waitlist resume) ────────────────
    if (!phone) return new Response(JSON.stringify({ error: 'Phone number required for paid events.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    const msisdn = normaliseMsisdn(phone);
    if (!/^2547\d{8}$/.test(msisdn)) return new Response(JSON.stringify({ error: 'Invalid Safaricom number. Use 07XXXXXXXX.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const stkAmount = isGroupTier
      ? effectivePrice * tier!.group_size!
      : effectivePrice * quantity;

    const token = await getNcbaToken();
    const stkResp = await ncbaFetch(`${ncbaBaseUrl}/payments/api/v1/stk-push/initiate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        TelephoneNo: msisdn, Amount: String(stkAmount),
        PayBillNo: mpesaPaybill, AccountNo: mpesaAccount,
        Network: 'Safaricom', TransactionType: 'CustomerPayBillOnline',
      }),
    });
    const stkData = await stkResp.json();
    if (!stkResp.ok || stkData.StatusCode === '1' || !stkData.TransactionID) {
      throw new Error(stkData.StatusDescription ?? 'STK push failed');
    }

    let leadRegId: string;

    if (approvedWaitlistRow) {
      // Resume payment for an approved waitlist user — update existing row
      await adminClient.from('event_registrations')
        .update({
          payment_status: 'pending_stk',
          payment_reference: stkData.TransactionID,
          price_paid: stkAmount,
          attendee_name: attendee_name.trim(),
          attendee_email: attendee_email.trim(),
        })
        .eq('id', approvedWaitlistRow.id);
      leadRegId = approvedWaitlistRow.id;
    } else {
      const { data: leadReg, error: regError } = await adminClient.from('event_registrations').insert({
        event_id, user_id: userId,
        attendee_name: attendee_name.trim(), attendee_email: attendee_email.trim(),
        tier_id: tier_id ?? null,
        payment_status: 'pending_stk',
        payment_reference: stkData.TransactionID,
        price_paid: stkAmount,
      }).select('id').single();
      if (regError) throw regError;
      leadRegId = leadReg.id;

      if (group_members && group_members.length > 0) {
        for (const m of group_members) {
          await adminClient.from('event_registrations').insert({
            event_id, user_id: null,
            attendee_name: m.name.trim(), attendee_email: m.email.trim(),
            tier_id: tier_id ?? null, group_lead_id: leadRegId,
            payment_status: 'pending_stk',
            payment_reference: stkData.TransactionID,
            price_paid: 0,
          });
        }
      }
    }

    return new Response(JSON.stringify({
      registration_id: leadRegId,
      transaction_id: stkData.TransactionID,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('register-event error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
