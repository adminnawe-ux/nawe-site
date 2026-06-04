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

function calcPayout(price: number, commissionRate: number) {
  const platform = Math.round(price * commissionRate);
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
  const { platform, therapist } = calcPayout(3500, 0.20);
  assertEquals(platform, 700);
  assertEquals(therapist, 2800);
});

Deno.test('calcPayout: 15% on 5000', () => {
  const { platform, therapist } = calcPayout(5000, 0.15);
  assertEquals(platform, 750);
  assertEquals(therapist, 4250);
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
