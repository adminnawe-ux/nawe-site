import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const googleServiceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';
const googlePrivateKey = Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

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
  return (await resp.json()).access_token as string;
}

async function createGoogleCalendar(title: string): Promise<string> {
  const token = await getGoogleToken();
  const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: title, description: `Calendar for ${title} event on Nawe` }),
  });
  if (!resp.ok) throw new Error(`Failed to create calendar: ${await resp.text()}`);
  const cal = await resp.json();
  return cal.id as string;
}

async function createCalendarEvent(calendarId: string, params: {
  title: string; location: string | null; starts_at: string; ends_at: string | null;
}): Promise<string> {
  const token = await getGoogleToken();
  const start = new Date(params.starts_at);
  const end = params.ends_at ? new Date(params.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const body = {
    summary: params.title,
    location: params.location ?? undefined,
    description: `Event details: ${appUrl}`,
    start: { dateTime: start.toISOString(), timeZone: 'Africa/Nairobi' },
    end: { dateTime: end.toISOString(), timeZone: 'Africa/Nairobi' },
    guestsCanSeeOtherGuests: false,
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 60 }] },
  };
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Failed to create calendar event: ${await resp.text()}`);
  const event = await resp.json();
  return event.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  let body: { event_id: string; title: string; location: string | null; starts_at: string; ends_at: string | null };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  const { event_id, title, location, starts_at, ends_at } = body;
  if (!event_id || !title || !starts_at) {
    return new Response(JSON.stringify({ error: 'event_id, title, and starts_at required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!googleServiceAccountEmail || !googlePrivateKey) {
      return new Response(JSON.stringify({ calendar_id: null, calendar_event_id: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const calendarId = await createGoogleCalendar(title);
    const eventId = await createCalendarEvent(calendarId, { title, location, starts_at, ends_at });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await adminClient.from('events')
      .update({ google_calendar_id: calendarId, google_calendar_event_id: eventId })
      .eq('id', event_id);

    return new Response(JSON.stringify({ calendar_id: calendarId, calendar_event_id: eventId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-event-calendar error:', err);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
