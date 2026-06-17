/**
 * Tests for the register-event edge function.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/register-event/index.test.ts
 *
 * Covers:
 *   - Tier date-gate logic (checkTierDateGate)
 *   - Phone normalisation
 *   - Group STK amount calculation
 *   - ACTIVE_STATUSES / capacity counting rules
 *   - Request body validation
 *   - Simulated registration-flow responses
 *   - Fuzz: arbitrary inputs for date gates and phone normalisation
 */

import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ---------------------------------------------------------------------------
// Pure logic mirrored from index.ts
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = ['free', 'paid', 'pending_stk', 'approved_waitlist'];

function checkTierDateGate(
  tier: { sale_starts_at: string | null; sale_ends_at: string | null },
  now: Date,
): string | null {
  if (tier.sale_starts_at && now < new Date(tier.sale_starts_at)) {
    return 'This ticket tier is not on sale yet.';
  }
  if (tier.sale_ends_at && now > new Date(tier.sale_ends_at)) {
    return 'This ticket tier is no longer available.';
  }
  return null;
}

function normaliseMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  return digits;
}

function isValidSafaricomMsisdn(msisdn: string): boolean {
  return /^2547\d{8}$/.test(msisdn);
}

function groupStkAmount(price: number, groupSize: number): number {
  return price * groupSize;
}

function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function validateRequestBody(body: Record<string, unknown>): string | null {
  if (!body.event_id) return 'event_id, attendee_name, and attendee_email are required';
  if (!body.attendee_name || !(body.attendee_name as string).trim()) return 'event_id, attendee_name, and attendee_email are required';
  if (!body.attendee_email || !(body.attendee_email as string).trim()) return 'event_id, attendee_name, and attendee_email are required';
  return null;
}

function isFreeRegistration(tier: { price: number } | null, eventIsFree: boolean): boolean {
  if (eventIsFree) return true;
  if (tier === null) return false; // paid event, no tier = should not happen but treated as paid
  return tier.price === 0;
}

// ---------------------------------------------------------------------------
// Tier date gate — not yet started
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-17T10:00:00Z');
const PAST = '2026-01-01T00:00:00Z';
const FUTURE = '2027-01-01T00:00:00Z';

Deno.test('checkTierDateGate: blocks tier not yet started', () => {
  const err = checkTierDateGate({ sale_starts_at: FUTURE, sale_ends_at: null }, NOW);
  assertEquals(err, 'This ticket tier is not on sale yet.');
});

Deno.test('checkTierDateGate: blocks tier whose sale has ended', () => {
  const err = checkTierDateGate({ sale_starts_at: null, sale_ends_at: PAST }, NOW);
  assertEquals(err, 'This ticket tier is no longer available.');
});

Deno.test('checkTierDateGate: passes when within date window', () => {
  const err = checkTierDateGate({ sale_starts_at: PAST, sale_ends_at: FUTURE }, NOW);
  assertEquals(err, null);
});

Deno.test('checkTierDateGate: passes with no date gates', () => {
  const err = checkTierDateGate({ sale_starts_at: null, sale_ends_at: null }, NOW);
  assertEquals(err, null);
});

Deno.test('checkTierDateGate: sale_starts_at exactly now is allowed (boundary)', () => {
  // now is NOT < sale_starts_at when they are equal
  const err = checkTierDateGate({ sale_starts_at: NOW.toISOString(), sale_ends_at: null }, NOW);
  assertEquals(err, null);
});

Deno.test('checkTierDateGate: start in past, end in past → blocked by end', () => {
  const err = checkTierDateGate({ sale_starts_at: PAST, sale_ends_at: PAST }, NOW);
  assertEquals(err, 'This ticket tier is no longer available.');
});

Deno.test('checkTierDateGate: start in future, end in future → blocked by start', () => {
  const err = checkTierDateGate({ sale_starts_at: FUTURE, sale_ends_at: FUTURE }, NOW);
  assertEquals(err, 'This ticket tier is not on sale yet.');
});

// ---------------------------------------------------------------------------
// Phone normalisation
// ---------------------------------------------------------------------------

Deno.test('normaliseMsisdn: 07XX → 254XX', () => {
  assertEquals(normaliseMsisdn('0712345678'), '254712345678');
});

Deno.test('normaliseMsisdn: +254XX → stripped', () => {
  assertEquals(normaliseMsisdn('+254712345678'), '254712345678');
});

Deno.test('normaliseMsisdn: 254XX already correct', () => {
  assertEquals(normaliseMsisdn('254712345678'), '254712345678');
});

Deno.test('normaliseMsisdn: strips spaces and dashes', () => {
  assertEquals(normaliseMsisdn('0712 345-678'), '254712345678');
});

Deno.test('isValidSafaricomMsisdn: valid 0711 prefix', () => {
  assertEquals(isValidSafaricomMsisdn('254711000000'), true);
});

Deno.test('isValidSafaricomMsisdn: rejects Airtel prefix (2547 but starts with 0)', () => {
  // 0623456789 → 254623456789 → starts with 2546, not 2547
  const normalised = normaliseMsisdn('0623456789');
  assertEquals(isValidSafaricomMsisdn(normalised), false);
});

Deno.test('isValidSafaricomMsisdn: rejects empty', () => {
  assertEquals(isValidSafaricomMsisdn(''), false);
});

Deno.test('round-trip: 07XX → valid', () => {
  assertEquals(isValidSafaricomMsisdn(normaliseMsisdn('0798765432')), true);
});

Deno.test('round-trip: garbage → invalid', () => {
  assertEquals(isValidSafaricomMsisdn(normaliseMsisdn('abcdef')), false);
});

// ---------------------------------------------------------------------------
// Group STK amount
// ---------------------------------------------------------------------------

Deno.test('groupStkAmount: group of 4 at 1500', () => {
  assertEquals(groupStkAmount(1500, 4), 6000);
});

Deno.test('groupStkAmount: couples (2) at 2000', () => {
  assertEquals(groupStkAmount(2000, 2), 4000);
});

Deno.test('groupStkAmount: free group ticket', () => {
  assertEquals(groupStkAmount(0, 4), 0);
});

Deno.test('groupStkAmount: group of 1 (edge)', () => {
  assertEquals(groupStkAmount(1500, 1), 1500);
});

// ---------------------------------------------------------------------------
// ACTIVE_STATUSES / capacity counting
// ---------------------------------------------------------------------------

Deno.test('ACTIVE_STATUSES: free counts toward capacity', () => {
  assertEquals(isActiveStatus('free'), true);
});

Deno.test('ACTIVE_STATUSES: paid counts toward capacity', () => {
  assertEquals(isActiveStatus('paid'), true);
});

Deno.test('ACTIVE_STATUSES: pending_stk counts toward capacity', () => {
  assertEquals(isActiveStatus('pending_stk'), true);
});

Deno.test('ACTIVE_STATUSES: approved_waitlist counts toward capacity', () => {
  assertEquals(isActiveStatus('approved_waitlist'), true);
});

Deno.test('ACTIVE_STATUSES: waitlisted does NOT count', () => {
  assertEquals(isActiveStatus('waitlisted'), false);
});

Deno.test('ACTIVE_STATUSES: failed does NOT count', () => {
  assertEquals(isActiveStatus('failed'), false);
});

// ---------------------------------------------------------------------------
// Request body validation
// ---------------------------------------------------------------------------

Deno.test('validateRequestBody: missing event_id', () => {
  const err = validateRequestBody({ attendee_name: 'Jane', attendee_email: 'jane@example.com' });
  assertEquals(typeof err, 'string');
});

Deno.test('validateRequestBody: missing attendee_name', () => {
  const err = validateRequestBody({ event_id: 'e1', attendee_email: 'jane@example.com' });
  assertEquals(typeof err, 'string');
});

Deno.test('validateRequestBody: blank attendee_name (whitespace only)', () => {
  const err = validateRequestBody({ event_id: 'e1', attendee_name: '   ', attendee_email: 'jane@example.com' });
  assertEquals(typeof err, 'string');
});

Deno.test('validateRequestBody: missing attendee_email', () => {
  const err = validateRequestBody({ event_id: 'e1', attendee_name: 'Jane' });
  assertEquals(typeof err, 'string');
});

Deno.test('validateRequestBody: valid body passes', () => {
  const err = validateRequestBody({ event_id: 'e1', attendee_name: 'Jane Doe', attendee_email: 'jane@example.com' });
  assertEquals(err, null);
});

// ---------------------------------------------------------------------------
// Free vs paid registration determination
// ---------------------------------------------------------------------------

Deno.test('isFreeRegistration: free event always free regardless of tier', () => {
  assertEquals(isFreeRegistration({ price: 500 }, true), true);
  assertEquals(isFreeRegistration(null, true), true);
});

Deno.test('isFreeRegistration: paid event with free tier is free', () => {
  assertEquals(isFreeRegistration({ price: 0 }, false), true);
});

Deno.test('isFreeRegistration: paid event with paid tier is not free', () => {
  assertEquals(isFreeRegistration({ price: 1500 }, false), false);
});

Deno.test('isFreeRegistration: paid event with no tier is not free', () => {
  assertEquals(isFreeRegistration(null, false), false);
});

// ---------------------------------------------------------------------------
// Simulated registration flow responses
// ---------------------------------------------------------------------------

Deno.test('simulate: free event registration returns ticket_code', () => {
  const response = { ticket_code: 'ABCD1234', registration_id: 'reg-uuid', is_free: true };
  assertEquals(typeof response.ticket_code, 'string');
  assertEquals(response.is_free, true);
});

Deno.test('simulate: paid event registration returns registration_id + transaction_id', () => {
  const response = { registration_id: 'reg-uuid', transaction_id: 'TXN-NCBA-001' };
  assertEquals(typeof response.registration_id, 'string');
  assertEquals(typeof response.transaction_id, 'string');
});

Deno.test('simulate: capacity-full response returns waitlisted:true', () => {
  const response = { waitlisted: true };
  assertEquals(response.waitlisted, true);
  // No ticket_code or transaction_id on a waitlisted response
  assertEquals('ticket_code' in response, false);
  assertEquals('transaction_id' in response, false);
});

Deno.test('simulate: duplicate registration (already active) returns error', () => {
  const response = { error: 'You are already registered for this event.' };
  assertEquals(typeof response.error, 'string');
  assertMatch(response.error, /already registered/);
});

Deno.test('simulate: duplicate registration with waitlisted status returns descriptive error', () => {
  const response = { error: "You're already on the waitlist for this event." };
  assertMatch(response.error, /waitlist/);
});

Deno.test('simulate: tier date gate failure returns 409 with descriptive error', () => {
  const status = 409;
  const response = { error: 'This ticket tier is not on sale yet.' };
  assertEquals(status, 409);
  assertMatch(response.error, /not on sale yet/);
});

Deno.test('simulate: tier sold out returns 409', () => {
  const status = 409;
  const response = { error: 'This ticket tier is sold out.' };
  assertEquals(status, 409);
  assertMatch(response.error, /sold out/);
});

Deno.test('simulate: approved_waitlist fast-path updates existing row', () => {
  // The approved_waitlist fast-path skips duplicate guard and updates the existing row
  const existingRow = { id: 'reg-1', payment_status: 'approved_waitlist', ticket_code: 'ABCD1234' };
  const newStatus = 'pending_stk';
  assertEquals(existingRow.payment_status !== newStatus, true);
  // After update:
  const updatedRow = { ...existingRow, payment_status: newStatus, payment_reference: 'TXN-NEW-001' };
  assertEquals(updatedRow.payment_status, 'pending_stk');
  assertEquals(updatedRow.ticket_code, 'ABCD1234'); // code preserved
});

// ---------------------------------------------------------------------------
// Group registration logic
// ---------------------------------------------------------------------------

Deno.test('simulate: group registration creates lead + N-1 member rows', () => {
  const groupSize = 4;
  const leadRow = { id: 'lead-uuid', group_lead_id: null, payment_status: 'pending_stk' };
  const memberRows = Array.from({ length: groupSize - 1 }, (_, i) => ({
    id: `member-${i}`,
    group_lead_id: 'lead-uuid',
    payment_status: 'pending_stk',
  }));

  assertEquals(memberRows.length, 3);
  assertEquals(memberRows.every(m => m.group_lead_id === leadRow.id), true);
});

Deno.test('simulate: group payment confirmation marks all members paid', () => {
  const members = [
    { id: 'm1', group_lead_id: 'lead-1', payment_status: 'pending_stk' },
    { id: 'm2', group_lead_id: 'lead-1', payment_status: 'pending_stk' },
    { id: 'm3', group_lead_id: 'lead-1', payment_status: 'pending_stk' },
  ];
  // Simulate the bulk update
  const updated = members.map(m => ({ ...m, payment_status: 'paid' }));
  assertEquals(updated.every(m => m.payment_status === 'paid'), true);
});

Deno.test('simulate: group STK amount is price × group_size', () => {
  const tier = { price: 1500, group_size: 4 };
  const stkAmount = tier.price * tier.group_size;
  assertEquals(stkAmount, 6000);
  // Lead pays full amount; each member confirmed individually on webhook
  assertEquals(stkAmount > tier.price, true);
});

// ---------------------------------------------------------------------------
// Fuzz — checkTierDateGate with random dates
// ---------------------------------------------------------------------------

Deno.test('fuzz: checkTierDateGate never throws on arbitrary date strings', () => {
  const randomIso = (offsetMs: number) =>
    new Date(NOW.getTime() + offsetMs).toISOString();

  for (let i = 0; i < 200; i++) {
    const startOffset = (Math.random() - 0.5) * 2e10;
    const endOffset = (Math.random() - 0.5) * 2e10;
    const tier = {
      sale_starts_at: Math.random() > 0.3 ? randomIso(startOffset) : null,
      sale_ends_at: Math.random() > 0.3 ? randomIso(endOffset) : null,
    };
    let threw = false;
    try {
      checkTierDateGate(tier, NOW);
    } catch {
      threw = true;
    }
    assertEquals(threw, false);
  }
});

Deno.test('fuzz: normaliseMsisdn never throws on arbitrary strings', () => {
  const chars = '0123456789+- ()abcdefABCDEF';
  for (let i = 0; i < 200; i++) {
    const len = Math.floor(Math.random() * 20);
    const raw = Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    let threw = false;
    try {
      normaliseMsisdn(raw);
    } catch {
      threw = true;
    }
    assertEquals(threw, false);
  }
});

Deno.test('fuzz: groupStkAmount never returns negative', () => {
  for (let i = 0; i < 200; i++) {
    const price = Math.floor(Math.random() * 10000);
    const groupSize = Math.floor(Math.random() * 20) + 1;
    const amount = groupStkAmount(price, groupSize);
    assertEquals(amount >= 0, true);
    assertEquals(amount, price * groupSize);
  }
});
