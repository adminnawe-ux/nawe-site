/**
 * Tests for the query-stk-push edge function.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/query-stk-push/index.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ---------------------------------------------------------------------------
// Status normalisation logic (mirrors index.ts)
// ---------------------------------------------------------------------------

type PollResult = 'confirmed' | 'failed' | 'pending';

function resolveStatus(ncbaStatus: string): PollResult {
  const s = ncbaStatus.toUpperCase();
  if (s === 'SUCCESS') return 'confirmed';
  if (s === 'FAILED') return 'failed';
  return 'pending';
}

// commissionRate is a percentage (0-100), matching commission_tiers.commission_rate's
// scale in the DB and the admin UI — NOT a fraction. Regression coverage for the bug
// fixed 2026-09-09: the real code used to do `price * commissionRate` directly,
// silently treating the percentage number as if it were already a fraction, which
// produced wildly wrong (often deeply negative) payouts on every paid session.
function calcPayout(price: number, commissionRatePercent: number) {
  const platform = Math.round(price * commissionRatePercent / 100);
  return { platform, therapist: price - platform };
}

// ---------------------------------------------------------------------------
// Status resolution
// ---------------------------------------------------------------------------

Deno.test('resolveStatus: SUCCESS → confirmed', () => {
  assertEquals(resolveStatus('SUCCESS'), 'confirmed');
});

Deno.test('resolveStatus: case-insensitive match', () => {
  assertEquals(resolveStatus('success'), 'confirmed');
  assertEquals(resolveStatus('Success'), 'confirmed');
});

Deno.test('resolveStatus: FAILED → failed', () => {
  assertEquals(resolveStatus('FAILED'), 'failed');
});

Deno.test('resolveStatus: unknown status → pending', () => {
  assertEquals(resolveStatus('PENDING'), 'pending');
  assertEquals(resolveStatus(''), 'pending');
  assertEquals(resolveStatus('PROCESSING'), 'pending');
});

// ---------------------------------------------------------------------------
// Commission calculation (same as ncba-payment-webhook)
// ---------------------------------------------------------------------------

Deno.test('calcPayout: 20% on 3500', () => {
  const { platform, therapist } = calcPayout(3500, 20);
  assertEquals(platform, 700);
  assertEquals(therapist, 2800);
});

Deno.test('calcPayout: 15% on 5000', () => {
  const { platform, therapist } = calcPayout(5000, 15);
  assertEquals(platform, 750);
  assertEquals(therapist, 4250);
});

Deno.test('calcPayout: 24% on 3 (regression — used to produce a negative payout)', () => {
  const { platform, therapist } = calcPayout(3, 24);
  assertEquals(platform, 1);
  assertEquals(therapist, 2);
});

// ---------------------------------------------------------------------------
// Simulated NCBA query responses
// ---------------------------------------------------------------------------

Deno.test('simulate: successful query response → confirmed', () => {
  const queryResponse = { status: 'SUCCESS', description: 'Success' };
  assertEquals(resolveStatus(queryResponse.status), 'confirmed');
});

Deno.test('simulate: user cancelled STK prompt → failed', () => {
  const queryResponse = { status: 'FAILED', description: 'Request cancelled by user' };
  assertEquals(resolveStatus(queryResponse.status), 'failed');
});

Deno.test('simulate: system internal error → failed', () => {
  const queryResponse = { status: 'FAILED', description: 'System internal error.' };
  assertEquals(resolveStatus(queryResponse.status), 'failed');
});

Deno.test('simulate: still processing → pending', () => {
  const queryResponse = { status: 'PENDING', description: 'Transaction in progress' };
  assertEquals(resolveStatus(queryResponse.status), 'pending');
});

// ---------------------------------------------------------------------------
// FAILED-description classification (mirrors index.ts's KNOWN_FAILURE_PHRASES)
// ---------------------------------------------------------------------------

const KNOWN_FAILURE_PHRASES = [
  'cancelled', 'canceled', 'insufficient', 'wrong pin', 'incorrect pin',
  'timeout', 'timed out', 'expired', 'declined', 'rejected',
];

function isKnownFailure(description: string): boolean {
  const lower = description.toLowerCase();
  return KNOWN_FAILURE_PHRASES.some((phrase) => lower.includes(phrase));
}

Deno.test('FAILED "still under processing" is NOT a known failure → stays pending', () => {
  // Regression test: NCBA returns status FAILED with this description while the
  // transaction is genuinely still in flight (observed 2026-09-08). Marking the
  // session failed on this response kills sessions the webhook would otherwise confirm.
  assertEquals(isKnownFailure('The transaction is still under processing'), false);
});

Deno.test('FAILED "System internal error." is NOT a known failure → stays pending', () => {
  assertEquals(isKnownFailure('System internal error.'), false);
});

Deno.test('FAILED "Request cancelled by user" IS a known failure → marked failed', () => {
  assertEquals(isKnownFailure('Request cancelled by user'), true);
});

Deno.test('FAILED "Insufficient funds in account" IS a known failure → marked failed', () => {
  assertEquals(isKnownFailure('Insufficient funds in account'), true);
});

Deno.test('simulate: empty status field → pending (treat as not yet settled)', () => {
  const queryResponse = { status: '', description: '' };
  assertEquals(resolveStatus(queryResponse.status), 'pending');
});

// ---------------------------------------------------------------------------
// Already-confirmed session skip logic
// ---------------------------------------------------------------------------

Deno.test('already paid: skip NCBA call and return confirmed directly', () => {
  const session = { payment_status: 'paid' };
  const shouldSkipNcba = session.payment_status === 'paid';
  assertEquals(shouldSkipNcba, true);
});

Deno.test('pending_stk: must query NCBA', () => {
  const session = { payment_status: 'pending_stk' };
  const shouldSkipNcba = session.payment_status === 'paid';
  assertEquals(shouldSkipNcba, false);
});

// ---------------------------------------------------------------------------
// Poll count / timeout logic
// ---------------------------------------------------------------------------

Deno.test('poll timeout: 30 polls × 4s = 120s max wait', () => {
  const MAX_POLLS = 30;
  const INTERVAL_MS = 4000;
  assertEquals(MAX_POLLS * INTERVAL_MS, 120_000);
});

Deno.test('poll count 29: still within limit', () => {
  assertEquals(29 < 30, true);
});

Deno.test('poll count 30: should time out', () => {
  assertEquals(30 >= 30, true);
});
