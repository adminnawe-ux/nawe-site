/**
 * Tests for the NCBA payment webhook.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/ncba-payment-webhook/index.test.ts
 *
 * Simulates NCBA Paybill Push Notification payloads (what NCBA POSTs when M-Pesa
 * money lands in the Paybill account). These are NOT STK push — they are server-to-
 * server callbacks triggered by the bank after the transaction settles.
 */

import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ---------------------------------------------------------------------------
// Pure logic extracted for unit testing (mirrors index.ts implementation)
// ---------------------------------------------------------------------------

async function computeHash(
  secretKey: string,
  p: {
    TransType?: string; TransID?: string; TransTime?: string;
    TransAmount?: string; BusinessShortCode?: string; BillRefNumber?: string;
    Mobile?: string; name?: string;
  }
): Promise<string> {
  const hashString =
    secretKey +
    (p.TransType ?? '') +
    (p.TransID ?? '') +
    (p.TransTime ?? '') +
    (p.TransAmount ?? '') +
    (p.BusinessShortCode ?? '') +
    (p.BillRefNumber ?? '') +
    (p.Mobile ?? '') +
    (p.name ?? '') +
    '1';
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashString));
  const sha256hex = Array.from(new Uint8Array(hashBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return btoa(String.fromCharCode(...new TextEncoder().encode(sha256hex)));
}

function parseAmount(raw: string | undefined): number {
  return parseFloat(raw ?? '0');
}

function isAmountSufficient(received: number, expected: number): boolean {
  return received >= expected - 1; // 1 KES tolerance
}

function calcPayout(price: number, commissionRate: number) {
  const platform = Math.round(price * commissionRate);
  return { platform, therapist: price - platform };
}

// ---------------------------------------------------------------------------
// Hash tests
// ---------------------------------------------------------------------------

Deno.test('computeHash: deterministic for same inputs', async () => {
  const h1 = await computeHash('mysecret', {
    TransType: 'PayBill', TransID: 'ABC123XYZ', TransTime: '20260429120000',
    TransAmount: '3500', BusinessShortCode: '880100',
    BillRefNumber: 'PBF2EXAMPLE', Mobile: '254712345678', name: 'John Doe',
  });
  const h2 = await computeHash('mysecret', {
    TransType: 'PayBill', TransID: 'ABC123XYZ', TransTime: '20260429120000',
    TransAmount: '3500', BusinessShortCode: '880100',
    BillRefNumber: 'PBF2EXAMPLE', Mobile: '254712345678', name: 'John Doe',
  });
  assertEquals(h1, h2);
});

Deno.test('computeHash: different inputs produce different hashes', async () => {
  const h1 = await computeHash('mysecret', { TransID: 'ABC123' });
  const h2 = await computeHash('mysecret', { TransID: 'XYZ999' });
  assertEquals(h1 !== h2, true);
});

Deno.test('computeHash: output is Base64 of hex string (64-byte hex → 88-char base64)', async () => {
  const h = await computeHash('key', { TransID: 'T1' });
  // SHA-256 hex = 64 chars → Base64 of those 64 bytes = 88 chars (with padding)
  assertEquals(h.length, 88);
  assertMatch(h, /^[A-Za-z0-9+/]+=*$/);
});

Deno.test('computeHash: wrong secret produces wrong hash', async () => {
  const correct = await computeHash('correct-secret', { TransID: 'T1', TransAmount: '1000' });
  const wrong = await computeHash('wrong-secret', { TransID: 'T1', TransAmount: '1000' });
  assertEquals(correct !== wrong, true);
});

// ---------------------------------------------------------------------------
// Amount validation tests
// ---------------------------------------------------------------------------

Deno.test('isAmountSufficient: exact match passes', () => {
  assertEquals(isAmountSufficient(3500, 3500), true);
});

Deno.test('isAmountSufficient: within 1 KES tolerance passes', () => {
  assertEquals(isAmountSufficient(3499.5, 3500), true);
});

Deno.test('isAmountSufficient: more than 1 KES short fails', () => {
  assertEquals(isAmountSufficient(3498, 3500), false);
});

Deno.test('isAmountSufficient: overpayment passes', () => {
  assertEquals(isAmountSufficient(4000, 3500), true);
});

Deno.test('parseAmount: valid string', () => {
  assertEquals(parseAmount('3500.00'), 3500);
});

Deno.test('parseAmount: missing value returns 0', () => {
  assertEquals(parseAmount(undefined), 0);
});

// ---------------------------------------------------------------------------
// Commission calculation tests
// ---------------------------------------------------------------------------

Deno.test('calcPayout: 20% commission on 3500', () => {
  const { platform, therapist } = calcPayout(3500, 0.20);
  assertEquals(platform, 700);
  assertEquals(therapist, 2800);
});

Deno.test('calcPayout: 15% commission on 5000', () => {
  const { platform, therapist } = calcPayout(5000, 0.15);
  assertEquals(platform, 750);
  assertEquals(therapist, 4250);
});

Deno.test('calcPayout: rounds to nearest integer', () => {
  // 3333 * 0.20 = 666.6 → rounds to 667
  const { platform, therapist } = calcPayout(3333, 0.20);
  assertEquals(platform, 667);
  assertEquals(therapist, 2666);
});

// ---------------------------------------------------------------------------
// Simulated webhook payloads (STK push notification simulation)
// These replicate the JSON body NCBA sends after a PayBill transaction.
// ---------------------------------------------------------------------------

Deno.test('simulate: standard NCBA PayBill payload shape', async () => {
  const secretKey = 'test-secret-key';

  // Build a realistic payload
  const payload = {
    TransType: 'PayBill',
    TransID: 'SIM001XYZ99',
    FTRef: 'FT2604291200',
    TransTime: '20260429120000',
    TransAmount: '3500.00',
    BusinessShortCode: '880100',
    BillRefNumber: 'PBF2EXAMPLE',
    Narrative: 'Payment from John Doe',
    Mobile: '254712345678',
    PhoneNr: '254712345678',
    name: 'John Doe',
    CustomerName: 'JOHN DOE',
    Username: 'nawe_webhook',
    Password: 'securepass123',
    Status: 'Success',
    created_at: '2026-04-29T12:00:00Z',
  };

  // Attach the correct hash
  const hash = await computeHash(secretKey, {
    TransType: payload.TransType,
    TransID: payload.TransID,
    TransTime: payload.TransTime,
    TransAmount: payload.TransAmount,
    BusinessShortCode: payload.BusinessShortCode,
    BillRefNumber: payload.BillRefNumber,
    Mobile: payload.Mobile,
    name: payload.name,
  });

  const signedPayload = { ...payload, Hash: hash };

  // Verify that our computed hash matches (simulates what the webhook does)
  const recomputed = await computeHash(secretKey, {
    TransType: signedPayload.TransType,
    TransID: signedPayload.TransID,
    TransTime: signedPayload.TransTime,
    TransAmount: signedPayload.TransAmount,
    BusinessShortCode: signedPayload.BusinessShortCode,
    BillRefNumber: signedPayload.BillRefNumber,
    Mobile: signedPayload.Mobile,
    name: signedPayload.name,
  });

  assertEquals(recomputed, signedPayload.Hash);
  assertEquals(isAmountSufficient(parseAmount(signedPayload.TransAmount), 3500), true);
  assertEquals(signedPayload.Username, 'nawe_webhook');
});

Deno.test('simulate: payload with alternate field names (PhoneNr, HashVal, AccountNr)', async () => {
  const secretKey = 'alt-secret';

  // Some NCBA integrations use alternate field names
  const payload = {
    TransType: 'PayBill',
    TransID: 'ALT002ABC88',
    TransTime: '20260429130000',
    TransAmount: '5000',
    AccountNr: '880100',       // alternate to BusinessShortCode
    Narrative: 'REF123',        // alternate to BillRefNumber
    PhoneNr: '254798765432',    // alternate to Mobile
    CustomerName: 'Jane Smith', // alternate to name
    HashVal: '',                // will be filled below
  };

  const hash = await computeHash(secretKey, {
    TransType: payload.TransType,
    TransID: payload.TransID,
    TransTime: payload.TransTime,
    TransAmount: payload.TransAmount,
    BusinessShortCode: payload.AccountNr, // normalised in webhook
    BillRefNumber: payload.Narrative,
    Mobile: payload.PhoneNr,
    name: payload.CustomerName,
  });

  payload.HashVal = hash;

  // Simulate normalisation logic from index.ts
  const shortCode = payload.AccountNr;
  const billRef = payload.Narrative;
  const mobile = payload.PhoneNr;
  const name = payload.CustomerName;

  const recomputed = await computeHash(secretKey, {
    TransType: payload.TransType,
    TransID: payload.TransID,
    TransTime: payload.TransTime,
    TransAmount: payload.TransAmount,
    BusinessShortCode: shortCode,
    BillRefNumber: billRef,
    Mobile: mobile,
    name,
  });

  assertEquals(recomputed, payload.HashVal);
});

Deno.test('simulate: tampered payload fails hash check', async () => {
  const secretKey = 'tamper-test';

  const hash = await computeHash(secretKey, {
    TransType: 'PayBill', TransID: 'TAMPER001', TransAmount: '3500',
  });

  // Attacker changes amount after signing
  const tamperedHash = await computeHash(secretKey, {
    TransType: 'PayBill', TransID: 'TAMPER001', TransAmount: '100', // changed
  });

  assertEquals(hash !== tamperedHash, true);
});

Deno.test('simulate: zero amount is invalid', () => {
  assertEquals(parseAmount('0') <= 0, true);
  assertEquals(parseAmount(undefined) <= 0, true);
});
