import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Max submissions per email per hour. Crisis callbacks are limited more strictly.
const RATE_LIMIT_PER_HOUR = 5;
const RATE_LIMIT_CRISIS_PER_HOUR = 2;

async function checkRateLimit(email: string, kind: string): Promise<boolean> {
  if (!email) return true; // phone-only submissions pass through
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await serviceClient
    .from('guest_intake_requests')
    .select('id', { count: 'exact', head: true })
    .eq('contact_email', email)
    .gte('created_at', since);

  const limit = kind === 'callback' ? RATE_LIMIT_CRISIS_PER_HOUR : RATE_LIMIT_PER_HOUR;
  return (count ?? 0) < limit;
}

async function recordRequest(email: string | null, phone: string | null, kind: string, payload: Record<string, unknown>) {
  if (!supabaseServiceRoleKey) return;
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await serviceClient.from('guest_intake_requests').insert({
    contact_email: email || null,
    contact_phone: phone || null,
    intake_payload: { kind, ...payload },
  });
}

type GuestRequestPayload = {
  kind: 'intake' | 'callback';
  contact_email?: string | null;
  contact_phone?: string | null;
  intake_payload?: Record<string, unknown>;
  crisis_flag?: boolean;
};

const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@nawe.co.ke';
const alertToEmail = Deno.env.get('ALERT_TO_EMAIL') ?? 'support@nawe.co.ke';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

function getAlertRecipients() {
  return alertToEmail
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

async function sendEmail(to: string | string[], subject: string, html: string) {
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

  let payload: GuestRequestPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const contactEmail = payload.contact_email?.trim() ?? '';
  const contactPhone = payload.contact_phone?.trim() ?? '';
  const intake = payload.intake_payload ?? {};
  if (contactEmail.length > 254 || contactPhone.length > 20) {
    return new Response(JSON.stringify({ error: 'One or more fields exceed the maximum allowed length.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const alertRecipients = getAlertRecipients();

  // Rate limit by email
  const allowed = await checkRateLimit(contactEmail, payload.kind);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' },
    });
  }

  try {
    // Persist request before sending emails so rate limit counts even if email fails
    await recordRequest(contactEmail || null, contactPhone || null, payload.kind, intake);
    if (payload.kind === 'intake') {
      if (contactEmail) {
        await sendEmail(
          contactEmail,
          'Complete your Nawe registration later',
          `
            <p>Thanks for sharing your details with Nawe.</p>
            <p>You can finish creating your account whenever you are ready here:</p>
            <p><a href="${appUrl}/signup">${appUrl}/signup</a></p>
            <p>Keep this email for later. If you already requested a session, our team will review your request and follow up.</p>
          `
        );
      }

      if (alertRecipients.length === 0) {
        throw new Error('ALERT_TO_EMAIL is not configured');
      }

      await sendEmail(
        alertRecipients,
        'New guest therapy request received',
        `
          <p>A new guest therapy request was submitted.</p>
          <p><strong>Email:</strong> ${contactEmail || 'not provided'}</p>
          <p><strong>Phone:</strong> ${contactPhone || 'not provided'}</p>
          <p><strong>Crisis flag:</strong> ${payload.crisis_flag ? 'Yes' : 'No'}</p>
          <p><strong>Intake summary:</strong></p>
          <pre style="white-space:pre-wrap">${JSON.stringify(intake, null, 2)}</pre>
        `
      );
    }

    if (payload.kind === 'callback') {
      if (alertRecipients.length === 0) {
        throw new Error('ALERT_TO_EMAIL is not configured');
      }

      await sendEmail(
        alertRecipients,
        'Urgent callback requested on Nawe',
        `
          <p>A user requested a callback from the crisis / support flow.</p>
          <p><strong>Email:</strong> ${contactEmail || 'not provided'}</p>
          <p><strong>Phone:</strong> ${contactPhone || 'not provided'}</p>
          <p><strong>Crisis flag:</strong> ${payload.crisis_flag ? 'Yes' : 'No'}</p>
          <p>Please route this to the available therapist or on-call support team as soon as possible.</p>
          <pre style="white-space:pre-wrap">${JSON.stringify(intake, null, 2)}</pre>
        `
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
