import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin: (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SessionStatusNotifyPayload = {
  session_id: string;
  status: 'confirmed' | 'cancelled';
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@nawe.co.ke';
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

  let payload: SessionStatusNotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!payload.session_id || !payload.status) {
    return new Response(JSON.stringify({ error: 'session_id and status are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!['confirmed', 'cancelled'].includes(payload.status)) {
    return new Response(JSON.stringify({ error: 'Unsupported status' }), {
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
      .select('id, client_id, therapist_id, scheduled_at, session_format, status')
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

    const { data: therapist, error: therapistError } = await adminClient
      .from('therapists')
      .select('id, user_id, professional_title')
      .eq('id', session.therapist_id)
      .maybeSingle();

    if (therapistError) {
      throw therapistError;
    }

    if (!therapist) {
      return new Response(JSON.stringify({ error: 'Therapist not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const therapistAuth = await adminClient.auth.admin.getUserById(therapist.user_id);
    const clientAuth = await adminClient.auth.admin.getUserById(session.client_id);

    if (therapistAuth.error) {
      throw therapistAuth.error;
    }
    if (clientAuth.error) {
      throw clientAuth.error;
    }

    if (therapistAuth.data.user?.id !== userData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: therapistProfile }, { data: clientProfile }] = await Promise.all([
      adminClient.from('profiles').select('first_name, last_name').eq('user_id', therapist.user_id).maybeSingle(),
      adminClient.from('profiles').select('first_name, last_name').eq('user_id', session.client_id).maybeSingle(),
    ]);

    const therapistName = formatDisplayName(therapistProfile?.first_name, therapistProfile?.last_name) || therapist.professional_title || 'Therapist';
    const clientName = formatDisplayName(clientProfile?.first_name, clientProfile?.last_name) || 'Client';
    const scheduledAt = formatScheduledAt(session.scheduled_at);
    const sessionUrl = `${appUrl}/dashboard`;

    if (payload.status === 'confirmed' && clientAuth.data.user?.email?.trim()) {
      await sendEmail(
        clientAuth.data.user.email.trim(),
        'Your Nawe session is confirmed',
        `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
            <p>Hello ${escapeHtml(clientName)},</p>
            <p>Your session with <strong>${escapeHtml(therapistName)}</strong> has been confirmed.</p>
            <p><strong>Date & time:</strong> ${escapeHtml(scheduledAt)}</p>
            <p><strong>Format:</strong> ${escapeHtml(session.session_format || 'pending')}</p>
            <p><strong>Status:</strong> Confirmed</p>
            <p>You can view your upcoming sessions in Nawe:</p>
            <p><a href="${sessionUrl}">${sessionUrl}</a></p>
          </div>
        `
      );
    }

    if (payload.status === 'cancelled' && clientAuth.data.user?.email?.trim()) {
      await sendEmail(
        clientAuth.data.user.email.trim(),
        'Your Nawe session request was declined',
        `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
            <p>Hello ${escapeHtml(clientName)},</p>
            <p>Your session request with <strong>${escapeHtml(therapistName)}</strong> was declined or cancelled.</p>
            <p><strong>Date & time:</strong> ${escapeHtml(scheduledAt)}</p>
            <p><strong>Status:</strong> Cancelled</p>
            <p>Please return to Nawe to book another therapist if needed:</p>
            <p><a href="${appUrl}/matches">${appUrl}/matches</a></p>
          </div>
        `
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
