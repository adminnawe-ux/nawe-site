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

const DEFAULT_COMMISSION_RATE = 0.20;

const VIDEO_FORMATS = ['Video Call', 'video'];

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function formatScheduledAt(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi',
  }).format(new Date(value));
}

async function sendEmail(to: string, subject: string, html: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });
  if (!resp.ok) throw new Error(`Resend error: ${await resp.text()}`);
}

// ── Google Calendar ────────────────────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: googleServiceAccountEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}`;

  // Parse PEM private key
  const pem = googlePrivateKey.replace(/\\n/g, '\n');
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

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

interface CalendarResult {
  meetLink: string | null;
  calendarLink: string;
  eventId: string;
}

async function createCalendarEvent(params: {
  sessionId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  clientEmail: string;
  therapistEmail: string;
  isVideo: boolean;
}): Promise<CalendarResult> {
  const accessToken = await getGoogleAccessToken();
  const start = new Date(params.scheduledAt);
  const end = new Date(start.getTime() + params.durationMinutes * 60_000);

  const body: Record<string, unknown> = {
    summary: params.title,
    start: { dateTime: start.toISOString(), timeZone: 'Africa/Nairobi' },
    end: { dateTime: end.toISOString(), timeZone: 'Africa/Nairobi' },
    attendees: [{ email: params.clientEmail }, { email: params.therapistEmail }],
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 15 }] },
  };

  if (params.isVideo) {
    body.conferenceData = {
      createRequest: {
        requestId: params.sessionId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events` +
    `?conferenceDataVersion=1&sendUpdates=all`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) throw new Error(`Google Calendar API error: ${await resp.text()}`);
  const event = await resp.json();

  const meetLink = event.conferenceData?.entryPoints?.find(
    (ep: { entryPointType: string; uri: string }) => ep.entryPointType === 'video',
  )?.uri ?? null;

  return { meetLink, calendarLink: event.htmlLink as string, eventId: event.id as string };
}

// ── Main handler ───────────────────────────────────────────────────────────────

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

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: roleRow } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let session_id: string;
  try {
    const body = await req.json();
    session_id = body.session_id;
    if (!session_id) throw new Error('session_id is required');
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { data: session, error: sessionError } = await adminClient
      .from('sessions')
      .select('id, client_id, therapist_id, price, currency, scheduled_at, session_format, duration_minutes, payment_reference, payment_status')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (session.payment_status !== 'pending_verification') {
      return new Response(JSON.stringify({ error: `Session payment_status is '${session.payment_status}', expected 'pending_verification'` }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const price = session.price ?? 0;
    const currency = session.currency ?? 'KES';
    const durationMinutes = session.duration_minutes ?? 50;
    const isVideo = VIDEO_FORMATS.includes(session.session_format ?? '');

    // Commission
    const { data: tiers } = await adminClient
      .from('commission_tiers')
      .select('commission_rate, min_revenue, max_revenue')
      .eq('currency', currency)
      .order('min_revenue', { ascending: true });

    const commissionRate = (tiers && tiers.length > 0) ? tiers[0].commission_rate : DEFAULT_COMMISSION_RATE;
    const platformCommission = Math.round(price * commissionRate);
    const therapistPayout = price - platformCommission;

    // Confirm payment
    const { error: updateError } = await adminClient
      .from('sessions')
      .update({ payment_status: 'paid', status: 'confirmed', therapist_payout: therapistPayout, platform_commission: platformCommission })
      .eq('id', session_id);

    if (updateError) throw updateError;

    // Fetch names and emails
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

    // Google Calendar event (best-effort — don't fail the payment if this errors)
    let meetLink: string | null = null;
    let calendarLink: string | null = null;

    if (googleServiceAccountEmail && googlePrivateKey && clientEmail && therapistEmail) {
      try {
        const cal = await createCalendarEvent({
          sessionId: session_id,
          title: `Nawe Session: ${clientName} & ${therapistName}`,
          scheduledAt: session.scheduled_at,
          durationMinutes,
          clientEmail,
          therapistEmail,
          isVideo,
        });
        meetLink = cal.meetLink;
        calendarLink = cal.calendarLink;

        // Persist Meet link on the session so the calendar UI can show it
        if (meetLink) {
          await adminClient.from('sessions').update({ session_link: meetLink }).eq('id', session_id);
        }
      } catch (calErr) {
        console.error('Google Calendar event creation failed (non-fatal):', calErr);
      }
    }

    const formattedDate = formatScheduledAt(session.scheduled_at);
    const commissionPct = Math.round(commissionRate * 100);

    // Build shared table rows for emails
    const calendarRow = calendarLink
      ? `<tr style="border-bottom:1px solid #e5e7eb">
           <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Calendar invite</td>
           <td style="padding:10px 14px"><a href="${calendarLink}" style="color:#10b981">View in Google Calendar →</a></td>
         </tr>`
      : '';

    const meetRow = meetLink
      ? `<tr style="border-bottom:1px solid #e5e7eb">
           <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Join session</td>
           <td style="padding:10px 14px"><a href="${meetLink}" style="color:#10b981;font-weight:bold">Join Google Meet →</a></td>
         </tr>`
      : '';

    // Email client
    if (clientEmail) {
      await sendEmail(
        clientEmail,
        'Your Nawe session is confirmed',
        `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
            <h2 style="color:#10b981">Your session is confirmed!</h2>
            <p>Hi ${escapeHtml(clientName)},</p>
            <p>Your payment has been verified and your session with <strong>${escapeHtml(therapistName)}</strong> is now confirmed.</p>
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
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Amount paid</td>
                <td style="padding:10px 14px;font-weight:bold">${escapeHtml(currency)} ${price.toLocaleString()}</td>
              </tr>
              ${meetRow}
              ${calendarRow}
            </table>
            ${meetLink ? '<p><strong>A Google Calendar invite has been sent to your email.</strong> You can join the session directly from the invite.</p>' : ''}
            <p><a href="${appUrl}/dashboard" style="color:#10b981">View your dashboard →</a></p>
          </div>
        `,
      );
    }

    // Email therapist
    if (therapistEmail) {
      await sendEmail(
        therapistEmail,
        `Confirmed session — ${escapeHtml(clientName)}`,
        `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
            <h2 style="color:#10b981">New confirmed session</h2>
            <p>Hi ${escapeHtml(therapistName)},</p>
            <p>A session with <strong>${escapeHtml(clientName)}</strong> has been confirmed and payment has been verified.</p>
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
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Format</td>
                <td style="padding:10px 14px">${escapeHtml(session.session_format ?? '')}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Session fee</td>
                <td style="padding:10px 14px">${escapeHtml(currency)} ${price.toLocaleString()}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Platform fee (${commissionPct}%)</td>
                <td style="padding:10px 14px;color:#ef4444">− ${escapeHtml(currency)} ${platformCommission.toLocaleString()}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Your payout</td>
                <td style="padding:10px 14px;font-size:18px;font-weight:bold;color:#10b981">${escapeHtml(currency)} ${therapistPayout.toLocaleString()}</td>
              </tr>
              ${meetRow}
              ${calendarRow}
            </table>
            ${meetLink ? '<p><strong>A Google Calendar invite has been sent to your email.</strong> You can join the session directly from the invite.</p>' : ''}
            <p><a href="${appUrl}/therapist-portal/calendar" style="color:#10b981">View your calendar →</a></p>
          </div>
        `,
      );
    }

    return new Response(
      JSON.stringify({ confirmed: true, therapist_payout: therapistPayout, platform_commission: platformCommission, meet_link: meetLink }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('confirm-payment error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
