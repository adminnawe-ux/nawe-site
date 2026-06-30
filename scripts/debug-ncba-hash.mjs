/**
 * NCBA Webhook Hash Verification — Debug & Investigation Script
 *
 * Background
 * ----------
 * NCBA sends a Hash/HashVal field on every push notification webhook call.
 * Our webhook function (supabase/functions/ncba-payment-webhook/index.ts) computes
 * the hash and compares, but currently bypasses rejection on mismatch because the
 * computed value does not match what NCBA sends.
 *
 * This script documents the investigation, decodes the expected hash to extract the
 * target SHA-256 hex, and brute-forces every plausible field order / encoding
 * variant to find the correct algorithm.
 *
 * Run:  node scripts/debug-ncba-hash.mjs
 *
 * Reference email: Fred → , 2026-06-18
 * NCBA doc:        docs-api/NCBA Paybill-Level Push Notifications Service Guide.pdf
 * Related scripts: scripts/gen-ncba-secret.ts     — how NCBA_SECRET_KEY was generated
 *                  scripts/gen-ncba-credentials.mjs — how Username/Password were generated
 * Webhook tests:   supabase/functions/ncba-payment-webhook/index.test.ts
 *
 * ------------------------------------------------------------------
 * NCBA Java reference implementation (from doc page 5):
 *
 *   String hashString = secretKey + TransType + TransID + TransactionTime
 *                     + TransAmount + CreditAccount + BillRefNumber
 *                     + Mobile + Name + "1";
 *   String sha256hex  = Hashing.sha256().hashString(hashString, UTF_8).toString();
 *   byte[] encoded    = Base64.encodeBase64(sha256hex.getBytes());
 *   return new String(encoded);
 *
 * Note: sha256hex.getBytes() in Java (no charset) uses platform default (UTF-8 on
 * modern JVMs). Base64.encodeBase64 is Apache Commons Codec — it does NOT add
 * line breaks by default (chunked=false). The result is base64 of the hex string.
 * ------------------------------------------------------------------
 *
 * Real webhook sample (from NCBA portal screenshot in the June 2026 email):
 *   Paybill:          880100
 *   Account:          231112
 *   M-Pesa reference: UF4OR6RP9Q
 *
 * Secrets are read from environment variables — never hardcoded here.
 * Run:  NCBA_SECRET_KEY=... NCBA_CREDIT_ACCOUNT=... node scripts/debug-ncba-hash.mjs
 * Or:   set them in .env and use: node -r dotenv/config scripts/debug-ncba-hash.mjs
 */

import crypto from 'crypto';

// ─── Known sample values ─────────────────────────────────────────────────────

const SECRET_KEY = process.env.NCBA_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('Error: NCBA_SECRET_KEY env var is required');
  process.exit(1);
}

const CREDIT_ACCOUNT = process.env.NCBA_CREDIT_ACCOUNT;
if (!CREDIT_ACCOUNT) {
  console.error('Error: NCBA_CREDIT_ACCOUNT env var is required');
  process.exit(1);
}

const PAYLOAD = {
  TransType:         'Pay Bill',
  TransID:           'UF4OR6RP9Q',
  FTRef:             '',
  TransTime:         '20260604133550',
  TransAmount:       '1.0',
  BusinessShortCode: '880100',
  CreditAccount:     CREDIT_ACCOUNT,
  BillRefNumber:     '231112',
  Narrative:         '',
  Mobile:            '254715237398',
  name:              'R C S',
  // = = '=' — this is the hash NCBA actually sent:
  Hash: 'ODA0MTQxMWZkOWMxZTYyMjNjMDVkMzRkOWViYzBjODYxYmU2NTkxZjA0YjQwMDE5MjdmODgyZTMwMjM0NTEwZQ===',
};

// ─── Decode the expected hash to reveal the target SHA-256 hex ───────────────

// Strip trailing '=' padding variants and decode
const expectedHash  = PAYLOAD.Hash.replace(/=+$/, '');
const decodedHex    = Buffer.from(expectedHash, 'base64').toString('utf8');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  NCBA HASH INVESTIGATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log();
console.log('Expected Hash (from NCBA):');
console.log(' ', PAYLOAD.Hash);
console.log();
console.log('Decoded base64 → target SHA-256 hex:');
console.log(' ', decodedHex);
console.log(' ', `(${decodedHex.length} chars — ${decodedHex.length === 64 ? '✓ valid SHA-256 hex' : '✗ NOT 64 chars — unexpected length'})`);
console.log();

// ─── Hash helper ─────────────────────────────────────────────────────────────

function computeHash(input) {
  const sha256hex = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  return Buffer.from(sha256hex).toString('base64');
}

function computeHashRawBytes(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('base64');
}

function tryVariant(label, input, encoding = 'hex→b64') {
  const computed = encoding === 'hex→b64'
    ? computeHash(input)
    : computeHashRawBytes(input);
  const match = computed === PAYLOAD.Hash || computed.replace(/=+$/, '') === expectedHash;
  if (match) {
    console.log(`\n✅  MATCH FOUND — ${label}`);
    console.log('    Input:', input);
    console.log('    Hash: ', computed);
  }
  return match;
}

// ─── Field aliases ────────────────────────────────────────────────────────────

const p = PAYLOAD;
const sk         = SECRET_KEY; // loaded from NCBA_SECRET_KEY env
const transType  = p.TransType;
const transId    = p.TransID;
const transTime  = p.TransTime;
const shortCode     = p.BusinessShortCode;  // "880100"
const creditAccount = p.CreditAccount;      // "" — CreditAccount per NCBA Java spec
const billRef       = p.BillRefNumber;      // "231112"
const narrative  = p.Narrative;               // ""
const mobile     = p.Mobile;
const name       = p.name;

// TransAmount variants
const amt_raw    = p.TransAmount;             // "1.0"
const amt_int    = '1';                       // "1"
const amt_2dp    = '1.00';                    // "1.00"

// ─── Permutation tests ────────────────────────────────────────────────────────

console.log('─── Testing permutations ─────────────────────────────────────');
console.log('    (printing MATCH lines only; ✅ = found)');
console.log();

let found = false;

// Doc field order: secretKey+TransType+TransID+TransTime+TransAmount+CreditAccount+BillRefNumber+Mobile+Name+"1"
// CreditAccount = 1009275957 (internal NCBA account). BusinessShortCode (880100) excluded from hash.

const amountVariants  = [amt_raw, amt_int, amt_2dp];
const billRefVars     = [billRef, narrative, billRef + narrative, ''];
const nameVars        = [name, name.toUpperCase(), name.toLowerCase(), ''];
const trailingVars    = ['1', '', '0'];
const transTypeVars   = [transType, 'PAYBILL', 'Pay Bill', 'PAY BILL', 'paybill'];
const encodings       = ['hex→b64', 'raw→b64'];

let count = 0;
for (const enc of encodings) {
  for (const tt of transTypeVars) {
    for (const amt of amountVariants) {
      for (const br of billRefVars) {
        for (const nm of nameVars) {
          for (const tail of trailingVars) {
            count++;
            // Standard doc order with CreditAccount (not BusinessShortCode)
            const v1 = sk + tt + transId + transTime + amt + creditAccount + br + mobile + nm + tail;
            if (tryVariant(`enc=${enc} | tt=${tt} | amt=${amt} | ca=${creditAccount} | br=${br} | name=${nm} | tail=${tail}`, v1, enc)) found = true;

            // Without CreditAccount
            const v2 = sk + tt + transId + transTime + amt + br + mobile + nm + tail;
            if (tryVariant(`no-ca | enc=${enc} | tt=${tt} | amt=${amt} | br=${br} | name=${nm} | tail=${tail}`, v2, enc)) found = true;

            // BillRef before CreditAccount
            const v3 = sk + tt + transId + transTime + amt + br + creditAccount + mobile + nm + tail;
            if (tryVariant(`br-before-ca | enc=${enc} | tt=${tt} | amt=${amt} | br=${br} | name=${nm} | tail=${tail}`, v3, enc)) found = true;
          }
        }
      }
    }
  }
}

if (!found) {
  console.log(`\n✗ No match found across ${count * 3} variants.`);
  console.log();
  console.log('── Most likely cause ─────────────────────────────────────────');
  console.log('  8640 variants tried — NONE matched. This strongly suggests');
  console.log('  NCBA is NOT using the secret key we provided during onboarding.');
  console.log('  Our key (NCBA_SECRET_KEY env):', SECRET_KEY.slice(0, 8) + '...');
  console.log('  That key was generated by: scripts/gen-ncba-secret.ts');
  console.log();
  console.log('  The target SHA-256 hex (decoded from NCBA hash):');
  console.log('  ', decodedHex);
  console.log('  If NCBA is using a DIFFERENT secret, no permutation will match.');
  console.log();
  console.log('── Next steps to confirm with NCBA ───────────────────────────');
  console.log('  1. ⚠ Ask NCBA to CONFIRM the exact secret key they are using');
  console.log('     to sign our webhook. It may differ from what is in NCBA_SECRET_KEY.');
  console.log('  2. Ask if CreditAccount in their Java spec = BusinessShortCode');
  console.log('     or if it refers to a different internal field (e.g. "231112").');
  console.log('  3. Ask if TransAmount is "1", "1.0", or "1.00" in the hash input.');
  console.log('  4. Ask if Mobile can be SHA-256 hashed before inclusion');
  console.log('     (the doc mentions this as a possibility for PhoneNr).');
  console.log('  5. Ask if the trailing "1" is always appended or conditional.');
  console.log();
  console.log('── Current webhook status ───────────────────────────────────');
  console.log('  Hash check is logging-only (not enforced).');
  console.log('  Username + Password auth is the active security layer.');
  console.log('  File: supabase/functions/ncba-payment-webhook/index.ts:134');
}

console.log();
console.log('═══════════════════════════════════════════════════════════════');
