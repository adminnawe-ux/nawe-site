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
const appUrl = Deno.env.get('APP_URL') ?? 'https://nawe.co.ke';
const unsubscribeTokenSecret = Deno.env.get('UNSUBSCRIBE_TOKEN_SECRET') ?? '';

const VALID_ROLES = ['client', 'therapist', 'admin'] as const;
type Role = (typeof VALID_ROLES)[number];

interface BroadcastRequest {
  subject: string;
  body: string;
  roles: string[];
  include_newsletter: boolean;
  cc?: string;
  preview?: boolean;
}

interface Recipient {
  email: string;
  user_id: string | null;
  subscriber_id: string | null;
  first_name: string | null;
}

// Fills the {{first_name}} merge tag written by admins in the composer.
// Recipients with no name on file (e.g. newsletter-only subscribers) get a generic greeting.
function applyMergeTags(body: string, recipient: { first_name: string | null }) {
  return body.replaceAll('{{first_name}}', recipient.first_name?.trim() || 'there');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parses a comma-separated CC field into a validated address list, dropping blanks.
function parseCcList(raw: string): string[] {
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && EMAIL_RE.test(e));
}

function toBase64Url(bytes: ArrayBuffer) {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
}

// Signs the recipient payload so unsubscribe-broadcast can trust it without
// re-authenticating the caller. Prevents forging a token for another user's
// UUID (e.g. therapist user_ids, which are publicly visible on /matches).
async function makeUnsubscribeToken(recipient: { user_id: string | null; subscriber_id: string | null; email: string }) {
  const payload = btoa(JSON.stringify({ u: recipient.user_id, s: recipient.subscriber_id, e: recipient.email }));
  const key = await hmacKey(unsubscribeTokenSecret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

// Merge registered-user and newsletter recipients, de-duplicated by lowercased email.
// Registered-user entries win on collision (carries user_id for the opt-out flag).
function mergeRecipients(registered: Recipient[], newsletter: Recipient[]): Recipient[] {
  const byEmail = new Map<string, Recipient>();
  for (const r of newsletter) {
    byEmail.set(r.email.toLowerCase(), r);
  }
  for (const r of registered) {
    byEmail.set(r.email.toLowerCase(), r);
  }
  return [...byEmail.values()];
}

async function sendEmail(to: string, subject: string, html: string, cc: string[]) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to, subject, html, ...(cc.length > 0 ? { cc } : {}) }),
  });
  if (!response.ok) {
    throw new Error(`Resend error: ${await response.text()}`);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Pages through the admin user list to build a user_id -> email map.
// Bounded to 10 pages (10k users) as a sanity limit for this platform's scale.
async function fetchEmailsByUserId(adminClient: ReturnType<typeof createClient>, userIds: Set<string>) {
  const emailByUserId = new Map<string, string>();
  const remaining = new Set(userIds);

  for (let page = 1; page <= 10 && remaining.size > 0; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    if (!data.users.length) break;

    for (const u of data.users) {
      if (remaining.has(u.id) && u.email) {
        emailByUserId.set(u.id, u.email);
        remaining.delete(u.id);
      }
    }
  }

  return emailByUserId;
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

  const { data: roleRow } = await adminClient
    .from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: BroadcastRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const subject = (payload.subject ?? '').trim();
  const body = (payload.body ?? '').trim();
  const roles = (payload.roles ?? []).filter((r): r is Role => (VALID_ROLES as readonly string[]).includes(r));
  const includeNewsletter = payload.include_newsletter === true;
  const cc = parseCcList(payload.cc ?? '');
  const isPreview = payload.preview === true;

  if (!isPreview && (!subject || !body || body === '<p></p>')) {
    return new Response(JSON.stringify({ error: 'Subject and body are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (roles.length === 0 && !includeNewsletter) {
    return new Response(JSON.stringify({ error: 'Select at least one audience' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let registered: Recipient[] = [];
    if (roles.length > 0) {
      const { data: roleRows, error: roleRowsError } = await adminClient
        .from('user_roles').select('user_id, role').in('role', roles);
      if (roleRowsError) throw roleRowsError;

      const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id as string))];

      // Batched to keep the `.in()` query string within request URL limits.
      const optedOut = new Set<string>();
      const firstNameByUserId = new Map<string, string | null>();
      for (const batch of chunk(userIds, 200)) {
        const { data: profileRows, error: profileError } = await adminClient
          .from('profiles').select('user_id, broadcast_opt_out, first_name').in('user_id', batch);
        if (profileError) throw profileError;
        for (const p of profileRows ?? []) {
          if (p.broadcast_opt_out) optedOut.add(p.user_id as string);
          firstNameByUserId.set(p.user_id as string, (p.first_name as string | null) ?? null);
        }
      }
      const eligibleUserIds = new Set(userIds.filter((id) => !optedOut.has(id)));

      const emailByUserId = await fetchEmailsByUserId(adminClient, eligibleUserIds);
      registered = [...eligibleUserIds]
        .map((id) => ({ user_id: id, email: emailByUserId.get(id) }))
        .filter((r): r is { user_id: string; email: string } => !!r.email)
        .map((r) => ({
          email: r.email, user_id: r.user_id, subscriber_id: null,
          first_name: firstNameByUserId.get(r.user_id) ?? null,
        }));
    }

    let newsletter: Recipient[] = [];
    if (includeNewsletter) {
      const { data: subRows, error: subError } = await adminClient
        .from('newsletter_subscribers').select('id, email').is('unsubscribed_at', null);
      if (subError) throw subError;
      newsletter = (subRows ?? []).map((s) => ({
        email: s.email as string, user_id: null, subscriber_id: s.id as string, first_name: null,
      }));
    }

    const recipients = mergeRecipients(registered, newsletter);

    if (isPreview) {
      return new Response(JSON.stringify({ recipient_count: recipients.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    if (!unsubscribeTokenSecret) {
      throw new Error('UNSUBSCRIBE_TOKEN_SECRET is not configured');
    }
    if (fromEmail.endsWith('@resend.dev')) {
      throw new Error(
        'RESEND_FROM_EMAIL must use your verified nawe.co.ke domain. Resend test senders on resend.dev only work for your own inbox.'
      );
    }

    let sent = 0;
    let failed = 0;
    const CONCURRENCY = 5;
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const batch = recipients.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (r) => {
          const unsubscribeUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(await makeUnsubscribeToken(r))}`;
          const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
              ${applyMergeTags(body, r)}
              <p style="color:#6b7280;font-size:13px;margin-top:32px">
                The Nawe Team · <a href="https://nawe.co.ke" style="color:#10b981">nawe.co.ke</a><br />
                <a href="${unsubscribeUrl}" style="color:#6b7280">Unsubscribe from these emails</a>
              </p>
            </div>`;
          return sendEmail(r.email, subject, html, cc);
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') sent++;
        else failed++;
      }
    }

    await adminClient.from('broadcast_sends').insert({
      subject,
      body,
      audience_roles: roles,
      include_newsletter: includeNewsletter,
      cc_addresses: cc,
      recipient_count: sent,
      failed_count: failed,
      sent_by: userData.user.id,
    });

    return new Response(JSON.stringify({ sent, failed, recipient_count: recipients.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-broadcast error:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
