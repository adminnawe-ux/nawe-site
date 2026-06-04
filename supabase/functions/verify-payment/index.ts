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
const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? 'admin@nawe.co.ke';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

interface RequestPayload {
  payment_reference: string;
  expected_amount: number;
  currency: string;
  therapist_id: string;
  client_id: string;
  scheduled_at: string;
  session_format: string;
  duration_minutes: number;
  notes_client?: string | null;
}

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

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    payment_reference, expected_amount, currency,
    therapist_id, client_id, scheduled_at, session_format,
    duration_minutes, notes_client,
  } = payload;

  if (!payment_reference || !expected_amount || !therapist_id || !client_id || !scheduled_at) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (userData.user.id !== client_id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Create session as pending_verification — admin confirms after checking NCBA
    const { data: session, error: insertError } = await adminClient
      .from('sessions')
      .insert({
        therapist_id,
        client_id,
        scheduled_at,
        session_format,
        duration_minutes,
        price: expected_amount,
        currency: currency ?? 'KES',
        status: 'pending',
        notes_client: notes_client ?? null,
        payment_reference,
        payment_status: 'pending_verification',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Session insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Could not create session. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch names for admin email
    const [{ data: clientProfile }, { data: therapist }] = await Promise.all([
      adminClient.from('profiles').select('first_name, last_name').eq('user_id', client_id).maybeSingle(),
      adminClient.from('therapists').select('user_id, professional_title').eq('id', therapist_id).maybeSingle(),
    ]);

    const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(' ')
      || userData.user.email || 'Unknown client';

    let therapistName = 'Unknown therapist';
    if (therapist?.user_id) {
      const { data: tp } = await adminClient.from('profiles').select('first_name, last_name').eq('user_id', therapist.user_id).maybeSingle();
      therapistName = [tp?.first_name, tp?.last_name].filter(Boolean).join(' ')
        || therapist.professional_title || 'Unknown therapist';
    }

    const formattedDate = formatScheduledAt(scheduled_at);
    const adminPanelUrl = `${appUrl}/admin/finance`;

    // Notify admin to manually verify payment in NCBA and confirm
    await sendEmail(
      adminEmail,
      `Payment pending verification — ${clientName}`,
      `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
          <h2 style="color:#10b981">New payment submitted — action required</h2>
          <p>A client has submitted an M-Pesa payment. Please check NCBA account <strong>231112</strong> and confirm receipt in the admin panel.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px">
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Client</td>
              <td style="padding:10px 14px">${escapeHtml(clientName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Therapist</td>
              <td style="padding:10px 14px">${escapeHtml(therapistName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Session Date</td>
              <td style="padding:10px 14px">${escapeHtml(formattedDate)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Format</td>
              <td style="padding:10px 14px">${escapeHtml(session_format)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Amount</td>
              <td style="padding:10px 14px;font-size:20px;font-weight:bold;color:#10b981">${escapeHtml(currency ?? 'KES')} ${expected_amount.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">M-Pesa Code</td>
              <td style="padding:10px 14px;font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:3px;color:#1f2937">${escapeHtml(payment_reference)}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Session ID</td>
              <td style="padding:10px 14px;font-family:monospace;font-size:12px;color:#6b7280">${session.id}</td>
            </tr>
          </table>
          <p style="margin-top:24px">
            <a href="${adminPanelUrl}" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold">
              Go to Admin Panel to Confirm →
            </a>
          </p>
        </div>
      `
    );

    return new Response(
      JSON.stringify({ submitted: true, session_id: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('verify-payment error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
