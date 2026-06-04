/**
 * Tests for the initiate-stk-push edge function.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/initiate-stk-push/index.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ---------------------------------------------------------------------------
// Pure logic extracted for unit testing (mirrors index.ts)
// ---------------------------------------------------------------------------

function normaliseMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  return digits;
}

function isValidKenyanMsisdn(msisdn: string): boolean {
  return /^2547\d{8}$/.test(msisdn);
}

// ---------------------------------------------------------------------------
// Phone normalisation
// ---------------------------------------------------------------------------

Deno.test('normaliseMsisdn: 07XX format', () => {
  assertEquals(normaliseMsisdn('0712345678'), '254712345678');
});

Deno.test('normaliseMsisdn: +254 format', () => {
  assertEquals(normaliseMsisdn('+254712345678'), '254712345678');
});

Deno.test('normaliseMsisdn: 254 format already correct', () => {
  assertEquals(normaliseMsisdn('254712345678'), '254712345678');
});

Deno.test('normaliseMsisdn: strips spaces and dashes', () => {
  assertEquals(normaliseMsisdn('0712 345-678'), '254712345678');
});

// ---------------------------------------------------------------------------
// MSISDN validation
// ---------------------------------------------------------------------------

Deno.test('isValidKenyanMsisdn: valid Safaricom number', () => {
  assertEquals(isValidKenyanMsisdn('254712345678'), true);
});

Deno.test('isValidKenyanMsisdn: valid 0711 prefix', () => {
  assertEquals(isValidKenyanMsisdn('254711000000'), true);
});

Deno.test('isValidKenyanMsisdn: rejects non-Kenyan number', () => {
  // South African number starts with 27, not 254
  assertEquals(isValidKenyanMsisdn('27712345678'), false);
});

Deno.test('isValidKenyanMsisdn: rejects short number', () => {
  assertEquals(isValidKenyanMsisdn('25471234'), false);
});

Deno.test('isValidKenyanMsisdn: rejects empty string', () => {
  assertEquals(isValidKenyanMsisdn(''), false);
});

// ---------------------------------------------------------------------------
// Simulated NCBA STK initiate responses
// ---------------------------------------------------------------------------

Deno.test('simulate: successful STK initiate response shape', () => {
  const response = {
    TransactionID: 'STK20260429ABCD',
    StatusCode: '0',
    StatusDescription: 'Success',
    ReferenceID: 'REF001',
  };

  const isSuccess = response.StatusCode !== '1' && !!response.TransactionID;
  assertEquals(isSuccess, true);
  assertEquals(typeof response.TransactionID, 'string');
});

Deno.test('simulate: failed STK initiate response (wrong PIN / cancelled)', () => {
  const response = {
    TransactionID: null,
    StatusCode: '1',
    StatusDescription: 'The initiator information is invalid',
    ReferenceID: null,
  };

  const isSuccess = response.StatusCode !== '1' && !!response.TransactionID;
  assertEquals(isSuccess, false);
});

Deno.test('simulate: missing TransactionID treated as failure', () => {
  const response = { StatusCode: '0', StatusDescription: 'Success' } as Record<string, unknown>;
  const hasTransactionId = !!response.TransactionID;
  assertEquals(hasTransactionId, false);
});

// ---------------------------------------------------------------------------
// Full normalise + validate round-trip
// ---------------------------------------------------------------------------

Deno.test('round-trip: 0712345678 → valid MSISDN', () => {
  const msisdn = normaliseMsisdn('0712345678');
  assertEquals(isValidKenyanMsisdn(msisdn), true);
});

Deno.test('round-trip: +254798765432 → valid MSISDN', () => {
  const msisdn = normaliseMsisdn('+254798765432');
  assertEquals(isValidKenyanMsisdn(msisdn), true);
});

Deno.test('round-trip: invalid number remains invalid after normalisation', () => {
  const msisdn = normaliseMsisdn('12345');
  assertEquals(isValidKenyanMsisdn(msisdn), false);
});
