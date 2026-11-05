/**
 * Tests for who may poll an event registration's payment status.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/query-event-payment/access.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { authorisePoll } from './access.ts';

const TXN = 'NCBA-TXN-123';

Deno.test('authorisePoll: guest row + matching transaction_id → ok (no login needed)', () => {
  assertEquals(authorisePoll({ leadUserId: null, leadPaymentReference: TXN, callerUserId: null, transactionId: TXN }), 'ok');
});

Deno.test('authorisePoll: guest row + wrong transaction_id → forbidden', () => {
  assertEquals(authorisePoll({ leadUserId: null, leadPaymentReference: TXN, callerUserId: null, transactionId: 'other' }), 'forbidden');
});

Deno.test('authorisePoll: guest row with no payment_reference → forbidden', () => {
  assertEquals(authorisePoll({ leadUserId: null, leadPaymentReference: null, callerUserId: null, transactionId: TXN }), 'forbidden');
});

Deno.test('authorisePoll: empty transaction_id never matches', () => {
  assertEquals(authorisePoll({ leadUserId: null, leadPaymentReference: '', callerUserId: null, transactionId: '' }), 'forbidden');
});

Deno.test('authorisePoll: owner polling own row → ok', () => {
  assertEquals(authorisePoll({ leadUserId: 'u1', leadPaymentReference: TXN, callerUserId: 'u1', transactionId: TXN }), 'ok');
});

// Regression: the ownership check from 901350a must still hold.
Deno.test('authorisePoll: another logged-in user polling an owned row → forbidden', () => {
  assertEquals(authorisePoll({ leadUserId: 'u1', leadPaymentReference: TXN, callerUserId: 'u2', transactionId: TXN }), 'forbidden');
});

Deno.test('authorisePoll: anonymous caller polling an owned row → forbidden even with the right transaction_id', () => {
  assertEquals(authorisePoll({ leadUserId: 'u1', leadPaymentReference: TXN, callerUserId: null, transactionId: TXN }), 'forbidden');
});

Deno.test('authorisePoll: owner with a mismatched transaction_id → forbidden', () => {
  assertEquals(authorisePoll({ leadUserId: 'u1', leadPaymentReference: TXN, callerUserId: 'u1', transactionId: 'other' }), 'forbidden');
});
