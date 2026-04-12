const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type GuestRequestPayload = {
  kind: 'intake' | 'callback';
  contact_email?: string | null;
  contact_phone?: string | null;
  intake_payload?: Record<string, unknown>;
  crisis_flag?: boolean;
};

const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
const alertToEmail = Deno.env.get('ALERT_TO_EMAIL') ?? 'support@nawe.co.ke';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

async function sendEmail(to: string | string[], subject: string, html: string) {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured');
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

  try {
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

      await sendEmail(
        alertToEmail,
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
      await sendEmail(
        alertToEmail,
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
