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

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  // Verify caller is admin
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

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: roleRow } = await adminClient
    .from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  let body: { registration_ids: string[] };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  const { registration_ids } = body;
  if (!Array.isArray(registration_ids) || registration_ids.length === 0) {
    return new Response(JSON.stringify({ error: 'registration_ids must be a non-empty array' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch the waitlisted registrations with their event data
  const { data: regs, error: fetchErr } = await adminClient
    .from('event_registrations')
    .select('id, attendee_name, attendee_email, ticket_code, payment_status, tier_id, event:events(id, title, location, starts_at, is_free, price, currency, slug)')
    .in('id', registration_ids)
    .eq('payment_status', 'waitlisted');

  if (fetchErr) return new Response(JSON.stringify({ error: fetchErr.message }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  if (!regs || regs.length === 0) {
    return new Response(JSON.stringify({ error: 'No waitlisted registrations found for the given IDs.' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const approved: string[] = [];
  const failed: string[] = [];

  for (const reg of regs) {
    try {
      const event = reg.event as {
        id: string; title: string; location: string | null; starts_at: string;
        is_free: boolean; price: number | null; currency: string; slug: string;
      };

      // Resolve tier name for email
      let tierName: string | null = null;
      if (reg.tier_id) {
        const { data: tierData } = await adminClient.from('event_ticket_tiers').select('name').eq('id', reg.tier_id).maybeSingle();
        tierName = tierData?.name ?? null;
      }

      const eventDate = new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi',
      }).format(new Date(event.starts_at));

      // Determine if this is a free event (no tier price, or tier is free, or event is free)
      const isFreeApproval = event.is_free && !reg.tier_id;

      if (isFreeApproval) {
        // Free event: approve immediately → status free, send ticket
        const { error: updateErr } = await adminClient.from('event_registrations')
          .update({ payment_status: 'free' })
          .eq('id', reg.id)
          .eq('payment_status', 'waitlisted');
        if (updateErr) throw updateErr;

        const ticketUrl = `${appUrl}/events/ticket/${reg.ticket_code}`;
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
            <h2 style="color:#10b981">Great news — you're in! 🎉</h2>
            <p>Hi ${escapeHtml(reg.attendee_name)},</p>
            <p>You've been approved off the waitlist for <strong>${escapeHtml(event.title)}</strong>. Your spot is now confirmed.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Date</td>
                <td style="padding:10px 14px">${escapeHtml(eventDate)}</td>
              </tr>
              ${event.location ? `<tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Location</td>
                <td style="padding:10px 14px">${escapeHtml(event.location)}</td>
              </tr>` : ''}
              ${tierName ? `<tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Ticket type</td>
                <td style="padding:10px 14px">${escapeHtml(tierName)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Ticket Code</td>
                <td style="padding:10px 14px;font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:3px">${escapeHtml(reg.ticket_code)}</td>
              </tr>
            </table>
            <p>
              <a href="${ticketUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
                View Your Ticket →
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px;margin-top:32px">The Nawe Team · <a href="https://nawe.co.ke" style="color:#10b981">nawe.co.ke</a></p>
          </div>`;
        await sendEmail(reg.attendee_email, `You're approved — ${event.title}`, html);
      } else {
        // Paid event: set approved_waitlist, email user to complete payment
        const { error: updateErr } = await adminClient.from('event_registrations')
          .update({ payment_status: 'approved_waitlist' })
          .eq('id', reg.id)
          .eq('payment_status', 'waitlisted');
        if (updateErr) throw updateErr;

        const eventUrl = `${appUrl}/events/${event.slug}`;
        const price = event.price ?? 0;
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
            <h2 style="color:#10b981">You've been approved — complete your payment</h2>
            <p>Hi ${escapeHtml(reg.attendee_name)},</p>
            <p>Good news! You've been approved off the waitlist for <strong>${escapeHtml(event.title)}</strong>.</p>
            <p>Your spot is reserved but won't be confirmed until payment is received. Please complete payment as soon as possible.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Date</td>
                <td style="padding:10px 14px">${escapeHtml(eventDate)}</td>
              </tr>
              ${event.location ? `<tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Location</td>
                <td style="padding:10px 14px">${escapeHtml(event.location)}</td>
              </tr>` : ''}
              ${tierName ? `<tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Ticket type</td>
                <td style="padding:10px 14px">${escapeHtml(tierName)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Amount due</td>
                <td style="padding:10px 14px;font-weight:bold;font-size:18px">${escapeHtml(event.currency)} ${price.toLocaleString()}</td>
              </tr>
            </table>
            <p>
              <a href="${eventUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
                Complete Payment →
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px">Your reserved spot may be released if payment is not received before the event.</p>
            <p style="color:#6b7280;font-size:13px;margin-top:32px">The Nawe Team · <a href="https://nawe.co.ke" style="color:#10b981">nawe.co.ke</a></p>
          </div>`;
        await sendEmail(reg.attendee_email, `Approved — complete your payment for ${event.title}`, html);
      }

      approved.push(reg.id);
    } catch (err) {
      console.error(`Failed to approve registration ${reg.id}:`, err);
      failed.push(reg.id);
    }
  }

  return new Response(JSON.stringify({ approved, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
