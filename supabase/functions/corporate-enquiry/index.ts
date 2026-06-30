import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('APP_URL') ?? 'https://nawe.co.ke').replace(/\/+$/, ''),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@nawe.co.ke';

function esc(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: {
    company_name?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    employees?: number;
    plan?: string;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { company_name, contact_name, email, phone, employees, plan, message } = body;

  if (!company_name?.trim() || !contact_name?.trim() || !email?.trim()) {
    return new Response(JSON.stringify({ error: 'company_name, contact_name and email are required.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (company_name.trim().length > 200 || contact_name.trim().length > 200 || email.trim().length > 254 ||
      (phone && phone.trim().length > 20) || (message && message.trim().length > 2000)) {
    return new Response(JSON.stringify({ error: 'One or more fields exceed the maximum allowed length.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: dbErr } = await adminClient.from('corporate_enquiries').insert({
    company_name: company_name.trim(),
    contact_name: contact_name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() ?? null,
    employees: employees ?? null,
    plan: plan ?? null,
    message: message?.trim() ?? null,
  });

  if (dbErr) {
    console.error('corporate-enquiry db error:', dbErr.message);
    return new Response(JSON.stringify({ error: 'Failed to save enquiry.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const planLabel = plan ? `<strong>${esc(plan)}</strong>` : 'Not specified';
  const employeesLabel = employees ? `${employees}` : 'Not specified';
  const phoneLabel = phone ? esc(phone) : 'Not provided';
  const messageLabel = message?.trim() ? `<p>${esc(message.trim())}</p>` : '<p><em>No message</em></p>';

  const html = `
    <h2>New Corporate Enquiry — Nawe Wellness</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td><strong>Company</strong></td><td>${esc(company_name.trim())}</td></tr>
      <tr><td><strong>Contact</strong></td><td>${esc(contact_name.trim())}</td></tr>
      <tr><td><strong>Email</strong></td><td>${esc(email.trim())}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${phoneLabel}</td></tr>
      <tr><td><strong>Employees</strong></td><td>${employeesLabel}</td></tr>
      <tr><td><strong>Plan</strong></td><td>${planLabel}</td></tr>
      <tr><td><strong>Message</strong></td><td>${messageLabel}</td></tr>
    </table>
  `;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: 'zippy@nawe.co.ke',
      cc: ['ithalii@nawe.co.ke'],
      reply_to: email.trim(),
      subject: `Corporate enquiry — ${company_name.trim()} (${plan ?? 'no plan'})`,
      html,
    }),
  });

  if (!emailRes.ok) {
    const txt = await emailRes.text();
    console.error('Resend error:', txt);
    // enquiry is already saved — don't fail the whole request
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
