/**
 * One-off script: send password reset notice to affected users.
 * Run with: node scripts/send-password-reset-notice.mjs
 *
 * Requires these vars in .env (or set in your shell):
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL  (optional, defaults to support@nawe.co.ke)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Add the email addresses of affected users here
// ---------------------------------------------------------------------------
const AFFECTED_EMAILS = [


];
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env not present — rely on shell env
  }
}

loadEnv();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'support@nawe.co.ke';
const RESET_URL = 'https://nawe.co.ke/forgot-password';

if (!RESEND_API_KEY) {
  console.error('Missing required env var: RESEND_API_KEY');
  process.exit(1);
}

async function sendEmail(email) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: 'Action needed: reset your Nawe password',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px">
          <h2 style="color:#10b981">Hi there,</h2>
          <p>
            Thank you for being part of Nawe — we truly appreciate your support and trust in our platform.
          </p>
          <p>
            We recently performed a maintenance reset on some accounts. As a result, you'll need to
            set a new password before your next sign-in.
          </p>
          <p>
            <a href="${RESET_URL}"
               style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
              Reset my password →
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">
            If you did not expect this email, you can safely ignore it.
          </p>
          <p style="color:#6b7280;font-size:13px;margin-top:32px">
            Warm regards,<br>The Nawe Team<br>
            <a href="https://nawe.co.ke" style="color:#10b981">nawe.co.ke</a>
          </p>
        </div>
      `,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Failed to send email');
  return json.id;
}

async function main() {
  console.log(`Sending password reset notices to ${AFFECTED_EMAILS.length} user(s)...\n`);

  for (const email of AFFECTED_EMAILS) {
    try {
      const emailId = await sendEmail(email);
      console.log(`✓ ${email}  (email id: ${emailId})`);
    } catch (err) {
      console.error(`✗ ${email}  — ${err.message}`);
    }
  }

  console.log('\nDone.');
}

main();
