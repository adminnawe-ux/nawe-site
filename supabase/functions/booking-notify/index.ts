import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type BookingNotifyPayload = {
  session_id: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@nawe.co.ke';
const alertToEmail = Deno.env.get('ALERT_TO_EMAIL') ?? 'support@nawe.co.ke';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDisplayName(firstName?: string | null, lastName?: string | null) {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (!first && !last) return '';
  if (first && !last) return first;
  if (!first && last) return last;

  return `${first} ${last?.charAt(0).toUpperCase()}.`;
}

function formatScheduledAt(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(date);
}

function buildSessionSummary(scheduledAt: string, sessionFormat: string | null, therapistName: string, therapistTitle: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
      <p>Your session has been received on <strong>Nawe</strong>.</p>
      <p><strong>Therapist:</strong> ${escapeHtml(therapistName)}${therapistTitle ? `, ${escapeHtml(therapistTitle)}` : ''}</p>
      <p><strong>Date & time:</strong> ${escapeHtml(scheduledAt)}</p>
      <p><strong>Format:</strong> ${escapeHtml(sessionFormat || 'pending')}</p>
      <p><strong>Status:</strong> Pending confirmation by your psychologist</p>
      <p>We will let you know once your therapist confirms the session.</p>
    </div>
  `;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (fromEmail.endsWith('@resend.dev')) {
    throw new Error(
      'RESEND_FROM_EMAIL must use your verified nawe.co.ke domain. Resend test senders on resend.dev only work for your own inbox.'
    );
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${text}`);
  }
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

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase function secrets are not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: BookingNotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!payload.session_id) {
    return new Response(JSON.stringify({ error: 'session_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: session, error: sessionError } = await adminClient
      .from('sessions')
      .select('id, client_id, scheduled_at, session_format, therapist_id')
      .eq('id', payload.session_id)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.client_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: therapist, error: therapistError }, { data: clientProfile }] = await Promise.all([
      adminClient
        .from('therapists')
        .select('user_id, professional_title')
        .eq('id', session.therapist_id)
        .maybeSingle(),
      adminClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', userData.user.id)
        .maybeSingle(),
    ]);

    if (therapistError) {
      throw therapistError;
    }

    if (!therapist) {
      return new Response(JSON.stringify({ error: 'Therapist not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: therapistAuth, error: therapistAuthError } = await adminClient.auth.admin.getUserById(therapist.user_id);
    if (therapistAuthError) {
      throw therapistAuthError;
    }

    const therapistEmail = therapistAuth.user?.email?.trim() ?? alertToEmail.split(',')[0]?.trim() ?? '';
    if (!therapistEmail) {
      throw new Error('No therapist email or fallback recipient configured');
    }

    const { data: therapistProfile } = await adminClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', therapist.user_id)
      .maybeSingle();

    const therapistName = formatDisplayName(therapistProfile?.first_name, therapistProfile?.last_name) || therapist.professional_title || 'Therapist';

    const clientName = formatDisplayName(clientProfile?.first_name, clientProfile?.last_name) || 'A client';
    const scheduledAt = formatScheduledAt(session.scheduled_at);
    const detailsUrl = `${appUrl}/therapist-portal/calendar`;

    await sendEmail(
      therapistEmail,
      'New Nawe session booked',
      `
        <p>Hello ${escapeHtml(therapistName)},</p>
        <p><strong>${escapeHtml(clientName)}</strong> booked a new session with you on Nawe.</p>
        <p><strong>Date & time:</strong> ${escapeHtml(scheduledAt)}</p>
        <p><strong>Format:</strong> ${escapeHtml(session.session_format || 'pending')}</p>
        <p>Please sign in to confirm or manage the session:</p>
        <p><a href="${detailsUrl}">${detailsUrl}</a></p>
      `
    );

    if (userData.user.email?.trim()) {
      await sendEmail(
        userData.user.email.trim(),
        'Your Nawe session is pending confirmation',
        buildSessionSummary(
          scheduledAt,
          session.session_format,
          therapistName,
          therapist.professional_title || ''
        )
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
