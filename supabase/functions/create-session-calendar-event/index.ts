import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This mirrors the Google Calendar + Meet logic already proven in confirm-payment
// (the admin manual-payment-verification path). That path already creates a
// Calendar event with a Meet link and writes it to sessions.session_link on
// confirmation — this function brings the SAME behaviour to the other paths
// that confirm a session (STK auto-confirm via query-stk-push and
// ncba-payment-webhook, and the therapist's manual "Confirm" button), so all
// confirmation paths behave identically instead of only one of them.

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const googleServiceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';
const googlePrivateKey = Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '';
const googleCalendarId = Deno.env.get('GOOGLE_CALENDAR_ID') ?? 'primary';

const VIDEO_FORMATS = ['video', 'Video Call', 'phone', 'Phone Call', 'messaging', 'Chat / Messaging'];

// ── Google Calendar (service account JWT bearer flow — same as confirm-payment) ──

async function getGoogleAccessToken(): Promise<string> {
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
  return (await resp.json()).access_token as string;
}

interface CalendarResult {
  meetLink: string | null;
  calendarLink: string;
  eventId: string;
}

async function createCalendarEvent(params: {
  sessionId: string; title: string; scheduledAt: string; durationMinutes: number;
  clientEmail: string; therapistEmail: string; isVideo: boolean;
}): Promise<CalendarResult> {
  const accessToken = await getGoogleAccessToken();
  const start = new Date(params.scheduledAt);
  const end = new Date(start.getTime() + params.durationMinutes * 60_000);

  // NOTE: no `attendees` here. Google's Calendar API rejects attendee invites from
  // a bare service account with 403 forbiddenForServiceAccounts ("Service accounts
  // cannot invite attendees without Domain-Wide Delegation of Authority") — and
  // Domain-Wide Delegation requires a Google Workspace domain, which isn't set up
  // (GOOGLE_CALENDAR_ID's owner is a personal Gmail account). So neither therapist
  // nor client gets a native Calendar invite email; instead sessions.session_link
  // (set below from the Meet link) surfaces the join link directly in the app —
  // ClientDashboard.tsx and TherapistCalendar.tsx both already show it there.
  const body: Record<string, unknown> = {
    summary: params.title,
    start: { dateTime: start.toISOString(), timeZone: 'Africa/Nairobi' },
    end: { dateTime: end.toISOString(), timeZone: 'Africa/Nairobi' },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
  };

  if (params.isVideo) {
    body.conferenceData = {
      createRequest: { requestId: params.sessionId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
    };
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events` +
    `?conferenceDataVersion=1`;
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

// ── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { session_id: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  const { session_id } = body;
  if (!session_id) {
    return new Response(JSON.stringify({ error: 'session_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authorization: either a trusted internal caller (our own edge functions,
  // using the service role key after already confirming payment) or the
  // therapist who owns this session (manual "Confirm" click).
  const authHeader = req.headers.get('Authorization') ?? '';
  const isInternalCall = !!supabaseServiceRoleKey && authHeader === `Bearer ${supabaseServiceRoleKey}`;

  const { data: session, error: sessionError } = await adminClient
    .from('sessions')
    .select('id, client_id, therapist_id, scheduled_at, duration_minutes, session_format, status, payment_status, google_calendar_event_id')
    .eq('id', session_id)
    .maybeSingle();

  if (sessionError || !session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!isInternalCall) {
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
    const { data: therapist } = await adminClient
      .from('therapists')
      .select('user_id')
      .eq('id', session.therapist_id)
      .maybeSingle();
    if (!therapist || therapist.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  if (session.status !== 'confirmed' || session.payment_status !== 'paid') {
    return new Response(JSON.stringify({ error: 'Session is not confirmed and paid' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Idempotent — skip if a calendar event already exists for this session.
  if (session.google_calendar_event_id) {
    return new Response(JSON.stringify({ calendar_event_id: session.google_calendar_event_id, skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!googleServiceAccountEmail || !googlePrivateKey) {
    console.warn('create-session-calendar-event: Google credentials not configured, skipping');
    return new Response(JSON.stringify({ calendar_event_id: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
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
      therapistEmail = tAuth.user?.email ?? '';
    }
    const { data: clientAuth } = await adminClient.auth.admin.getUserById(session.client_id);
    const clientEmail = clientAuth.user?.email ?? '';

    if (!clientEmail || !therapistEmail) {
      return new Response(JSON.stringify({ calendar_event_id: null, error: 'Missing client or therapist email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isVideo = VIDEO_FORMATS.includes(session.session_format ?? '');
    const cal = await createCalendarEvent({
      sessionId: session.id,
      title: `Nawe Session: ${clientName} & ${therapistName}`,
      scheduledAt: session.scheduled_at,
      durationMinutes: session.duration_minutes ?? 50,
      clientEmail, therapistEmail, isVideo,
    });

    const updates: Record<string, string> = { google_calendar_id: googleCalendarId, google_calendar_event_id: cal.eventId };
    if (cal.meetLink) updates.session_link = cal.meetLink; // so the calendar UI can show a join link

    await adminClient.from('sessions').update(updates).eq('id', session.id);

    return new Response(JSON.stringify({ calendar_id: googleCalendarId, calendar_event_id: cal.eventId, calendar_link: cal.calendarLink, meet_link: cal.meetLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Non-critical — the session stays confirmed even if the calendar event fails.
    console.error('create-session-calendar-event error:', err);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred creating the calendar event.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
