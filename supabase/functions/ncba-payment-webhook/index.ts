import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@nawe.co.ke';
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';

// Credentials you provide to NCBA in the letter
const ncbaWebhookUsername = Deno.env.get('NCBA_WEBHOOK_USERNAME') ?? '';
const ncbaWebhookPassword = Deno.env.get('NCBA_WEBHOOK_PASSWORD') ?? '';
const ncbaSecretKey = Deno.env.get('NCBA_SECRET_KEY') ?? '';

const DEFAULT_COMMISSION_RATE = 0.20;

interface NCBAPayload {
  TransType?: string;
  TransID?: string;
  FTRef?: string;
  TransTime?: string;
  TransAmount?: string;
  BusinessShortCode?: string;
  AccountNr?: string;
  BillRefNumber?: string;
  Narrative?: string;
  Mobile?: string;
  PhoneNr?: string;
  name?: string;
  CustomerName?: string;
  Username?: string;
  Password?: string;
  Hash?: string;
  HashVal?: string;
  Status?: string;
  created_at?: string;
}

// Hash verification per NCBA spec:
// SHA256(secretKey + TransType + TransID + TransTime + TransAmount + BusinessShortCode + BillRefNumber + Mobile + name + "1")
// → hex string → Base64 encode the hex bytes
async function verifyHash(p: NCBAPayload): Promise<boolean> {
  if (!ncbaSecretKey) return true; // skip if not configured (dev mode)

  const transType = p.TransType ?? '';
  const transId = p.TransID ?? '';
  const transTime = p.TransTime ?? '';
  const transAmount = p.TransAmount ?? '';
  const shortCode = p.BusinessShortCode ?? p.AccountNr ?? '';
  const billRef = p.BillRefNumber ?? p.Narrative ?? '';
  const mobile = p.Mobile ?? p.PhoneNr ?? '';
  const name = p.name ?? p.CustomerName ?? '';
  const incomingHash = p.Hash ?? p.HashVal ?? '';

  const hashString = ncbaSecretKey + transType + transId + transTime + transAmount + shortCode + billRef + mobile + name + '1';
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashString));
  const sha256hex = Array.from(new Uint8Array(hashBytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const computed = btoa(String.fromCharCode(...new TextEncoder().encode(sha256hex)));

  return computed === incomingHash;
}

function ok(desc = 'Payment processed') {
  return new Response(JSON.stringify({ ResultCode: '0', ResultDesc: desc }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

function fail(desc: string, status = 200) {
  // NCBA expects HTTP 200 with ResultCode "1" for logical failures
  return new Response(JSON.stringify({ ResultCode: '1', ResultDesc: desc }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi',
  }).format(new Date(value));
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendApiKey || !to) return;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });
  if (!resp.ok) console.error('Resend error:', await resp.text());
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  let payload: NCBAPayload;
  try {
    payload = await req.json();
  } catch {
    return fail('Invalid JSON body', 400);
  }

  // 1. Verify credentials
  if (ncbaWebhookUsername && payload.Username !== ncbaWebhookUsername) {
    console.error('NCBA webhook: invalid username');
    return fail('Authentication failed');
  }
  if (ncbaWebhookPassword && payload.Password !== ncbaWebhookPassword) {
    console.error('NCBA webhook: invalid password');
    return fail('Authentication failed');
  }

  // 2. Verify hash signature
  const hashValid = await verifyHash(payload);
  if (!hashValid) {
    console.error('NCBA webhook: hash verification failed');
    return fail('Hash verification failed');
  }

  const transId = payload.TransID;
  const transAmount = parseFloat(payload.TransAmount ?? '0');

  if (!transId) return fail('Missing TransID');
  if (!transAmount || transAmount <= 0) return fail('Invalid TransAmount');

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Find matching session by payment_reference (M-Pesa code user entered)
  const { data: session, error: sessionError } = await adminClient
    .from('sessions')
    .select('id, client_id, therapist_id, price, currency, scheduled_at, session_format, duration_minutes, payment_status')
    .eq('payment_reference', transId)
    .eq('payment_status', 'pending_verification')
    .maybeSingle();

  if (sessionError) {
    console.error('Session lookup error:', sessionError);
    return fail('Database error');
  }

  if (!session) {
    // Store notification for later matching (session may not exist yet)
    await adminClient.from('ncba_payment_notifications').insert({
      trans_id: transId,
      trans_type: payload.TransType ?? null,
      trans_amount: transAmount,
      trans_time: payload.TransTime ?? null,
      bill_ref_number: payload.BillRefNumber ?? payload.Narrative ?? null,
      mobile: payload.Mobile ?? payload.PhoneNr ?? null,
      customer_name: payload.name ?? payload.CustomerName ?? null,
      raw_payload: payload,
      matched: false,
    }).catch((e) => console.error('Failed to store unmatched notification:', e));

    // Still return OK so NCBA doesn't keep retrying
    return ok('Notification received — no matching session yet');
  }

  // 4. Verify amount — allow small rounding differences (within 1 KES)
  if (transAmount < (session.price ?? 0) - 1) {
    console.error(`Amount mismatch: received ${transAmount}, expected ${session.price}`);
    return fail('Amount mismatch');
  }

  // 5. Calculate commission
  const price = session.price ?? 0;
  const currency = session.currency ?? 'KES';

  const { data: tiers } = await adminClient
    .from('commission_tiers')
    .select('commission_rate')
    .eq('currency', currency)
    .order('min_revenue', { ascending: true });

  const commissionRate = tiers?.[0]?.commission_rate ?? DEFAULT_COMMISSION_RATE;
  const platformCommission = Math.round(price * commissionRate);
  const therapistPayout = price - platformCommission;
  const commissionPct = Math.round(commissionRate * 100);

  // 6. Confirm session
  const { error: updateError } = await adminClient
    .from('sessions')
    .update({
      payment_status: 'paid',
      status: 'confirmed',
      therapist_payout: therapistPayout,
      platform_commission: platformCommission,
    })
    .eq('id', session.id);

  if (updateError) {
    console.error('Session update error:', updateError);
    return fail('Failed to confirm session');
  }

  // Mark any stored notification as matched
  await adminClient
    .from('ncba_payment_notifications')
    .update({ matched: true, session_id: session.id })
    .eq('trans_id', transId)
    .catch(() => {});

  // 7. Fetch names and emails for confirmation
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
  const formattedDate = formatDate(session.scheduled_at);

  // Email client
  if (clientEmail) {
    await sendEmail(clientEmail, 'Your Nawe session is confirmed', `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
        <h2 style="color:#10b981">Payment received — session confirmed!</h2>
        <p>Hi ${escapeHtml(clientName)},</p>
        <p>Your M-Pesa payment has been verified and your session with <strong>${escapeHtml(therapistName)}</strong> is confirmed.</p>
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
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Amount paid</td>
            <td style="padding:10px 14px;font-weight:bold">${escapeHtml(currency)} ${price.toLocaleString()}</td>
          </tr>
        </table>
        <p><a href="${appUrl}/dashboard" style="color:#10b981">View your dashboard →</a></p>
      </div>
    `);
  }

  // Email therapist
  if (therapistEmail) {
    await sendEmail(therapistEmail, `Confirmed session — ${escapeHtml(clientName)}`, `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
        <h2 style="color:#10b981">New confirmed session</h2>
        <p>Hi ${escapeHtml(therapistName)},</p>
        <p>Payment verified for session with <strong>${escapeHtml(clientName)}</strong>.</p>
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
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Session fee</td>
            <td style="padding:10px 14px">${escapeHtml(currency)} ${price.toLocaleString()}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Platform fee (${commissionPct}%)</td>
            <td style="padding:10px 14px;color:#ef4444">− ${escapeHtml(currency)} ${platformCommission.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#6b7280;background:#f9fafb">Your payout</td>
            <td style="padding:10px 14px;font-size:18px;font-weight:bold;color:#10b981">${escapeHtml(currency)} ${therapistPayout.toLocaleString()}</td>
          </tr>
        </table>
        <p><a href="${appUrl}/therapist-portal/calendar" style="color:#10b981">View your calendar →</a></p>
      </div>
    `);
  }

  console.log(`Payment auto-confirmed: session=${session.id} transId=${transId} amount=${transAmount}`);
  return ok('Payment confirmed successfully');
});
