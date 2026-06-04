/**
 * One-off script: test NCBA STK push initiation directly.
 * Run with: node scripts/test-stk-push.mjs
 *
 * Reads from .env:
 *   NCBA_STK_USERNAME
 *   NCBA_STK_PASSWORD
 *   MPESA_PAYBILL      (defaults to 880100)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config — edit these for your test
// ---------------------------------------------------------------------------
const TEST_PHONE  = '07xxxxxxxx';   // Safaricom number to send prompt to
const TEST_AMOUNT = '1';            // Amount in KES (use 1 for testing)
// ---------------------------------------------------------------------------

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
    // rely on shell env
  }
}

loadEnv();

const USERNAME  = process.env.NCBA_STK_USERNAME ?? '';
const PASSWORD  = process.env.NCBA_STK_PASSWORD ?? '';
const PAYBILL   = process.env.MPESA_PAYBILL ?? '880100';
const ACCOUNT   = process.env.MPESA_ACCOUNT ?? PAYBILL;
const BASE_URL  = 'https://c2bapis.ncbagroup.com';

if (!USERNAME || !PASSWORD) {
  console.error('Missing NCBA_STK_USERNAME or NCBA_STK_PASSWORD in .env');
  process.exit(1);
}

function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('0') ? '254' + digits.slice(1) : digits;
}

async function getToken() {
  const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  console.log('\n── Step 1: Get NCBA auth token ────────────────────────');
  console.log(`POST ${BASE_URL}/payments/api/v1/auth/token`);

  const res = await fetch(`${BASE_URL}/payments/api/v1/auth/token`, {
    method: 'GET',
    headers: { Authorization: `Basic ${credentials}` },
  });

  const body = await res.json();
  console.log(`Status: ${res.status}`);
  console.log('Response:', JSON.stringify(body, null, 2));

  if (!res.ok || !body.access_token) {
    throw new Error(`Token request failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

async function initiateStk(token, msisdn) {
  const payload = {
    TelephoneNo: msisdn,
    Amount: TEST_AMOUNT,
    PayBillNo: PAYBILL,
    AccountNo: ACCOUNT,
    Network: 'Safaricom',
    TransactionType: 'CustomerPayBillOnline',
  };

  console.log('\n── Step 2: Initiate STK push ───────────────────────────');
  console.log(`POST ${BASE_URL}/payments/api/v1/stk-push/initiate`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const res = await fetch(`${BASE_URL}/payments/api/v1/stk-push/initiate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  console.log(`Status: ${res.status}`);
  console.log('Response:', JSON.stringify(body, null, 2));
  return body;
}

async function main() {
  const msisdn = normalisePhone(TEST_PHONE);
  if (!/^2547\d{8}$/.test(msisdn)) {
    console.error(`Invalid phone number: ${TEST_PHONE} → ${msisdn}`);
    console.error('Set TEST_PHONE to a valid Safaricom number (07XXXXXXXX).');
    process.exit(1);
  }

  console.log(`Using credentials: ${USERNAME} / ${'*'.repeat(PASSWORD.length)}`);
  console.log(`Paybill: ${PAYBILL}  |  Account: ${ACCOUNT}  |  Phone: ${msisdn}  |  Amount: KES ${TEST_AMOUNT}`);

  try {
    const token = await getToken();
    const result = await initiateStk(token, msisdn);

    if (result.TransactionID) {
      console.log(`\n✓ STK push sent! TransactionID: ${result.TransactionID}`);
      console.log('Check your phone for the M-Pesa prompt.');
    } else {
      console.log('\n✗ STK push failed — see response above.');
    }
  } catch (err) {
    console.error('\n✗ Error:', err.message);
  }
}

main();
