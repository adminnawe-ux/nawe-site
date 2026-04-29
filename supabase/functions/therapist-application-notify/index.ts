import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin: (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@nawe.co.ke';
const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? '';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

  try {
    const [{ data: profile }, { data: therapist }] = await Promise.all([
      adminClient.from('profiles').select('first_name, last_name').eq('user_id', userData.user.id).maybeSingle(),
      adminClient.from('therapists').select('professional_title, license_number, issuing_body, years_experience').eq('user_id', userData.user.id).maybeSingle(),
    ]);

    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Unknown';
    const email = userData.user.email ?? '';

    if (adminEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: adminEmail,
          subject: `New therapist application — ${name}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
              <h2 style="color:#10b981">New therapist application</h2>
              <p>A therapist has completed their onboarding application and is awaiting review.</p>
              <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e5e7eb">
                <tr style="border-bottom:1px solid #e5e7eb">
                  <td style="padding:10px 14px;font-weight:bold;color:#6b7280;width:40%;background:#f9fafb">Name</td>
                  <td style="padding:10px 14px">${escapeHtml(name)}</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb">
                  <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Email</td>
                  <td style="padding:10px 14px">${escapeHtml(email)}</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb">
                  <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Title</td>
                  <td style="padding:10px 14px">${escapeHtml(therapist?.professional_title ?? '—')}</td>
                </tr>
                <tr style="border-bottom:1px solid #e5e7eb">
                  <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Licence</td>
                  <td style="padding:10px 14px">${escapeHtml(therapist?.license_number ?? '—')} (${escapeHtml(therapist?.issuing_body ?? '—')})</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Experience</td>
                  <td style="padding:10px 14px">${therapist?.years_experience ?? '—'} years</td>
                </tr>
              </table>
              <p>
                <a href="${appUrl}/admin/therapists" style="display:inline-block;background:#10b981;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
                  Review application →
                </a>
              </p>
            </div>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ notified: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('therapist-application-notify error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
