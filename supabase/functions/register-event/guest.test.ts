/**
 * Tests for guest (no-login) event registration logic.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/register-event/guest.test.ts
 *
 * Unlike index.test.ts these import the real helpers from guest.ts, so a
 * change to the production logic is caught here.
 */

import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  escapeLikePattern,
  guestDuplicateResponse,
  isValidEmail,
  normaliseEmail,
  pickGuestDuplicate,
  resolveGuestDuplicate,
  validateResumeRow,
  TICKET_RESEND_COOLDOWN_MS,
} from './guest.ts';

const NOW = new Date('2026-11-05T10:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

// ---------------------------------------------------------------------------
// Email handling
// ---------------------------------------------------------------------------

Deno.test('normaliseEmail: trims and lowercases', () => {
  assertEquals(normaliseEmail('  Jane.Doe@Example.COM '), 'jane.doe@example.com');
});

Deno.test('isValidEmail: accepts ordinary addresses', () => {
  assert(isValidEmail('jane@example.com'));
  assert(isValidEmail('first_last+tag@sub.example.co.ke'));
});

Deno.test('isValidEmail: rejects malformed addresses', () => {
  for (const bad of ['', 'jane', 'jane@', '@example.com', 'jane@example', 'ja ne@example.com', 'a@b@c.com']) {
    assertFalse(isValidEmail(bad), bad);
  }
});

Deno.test('escapeLikePattern: escapes ILIKE wildcards so "_" in an email is literal', () => {
  assertEquals(escapeLikePattern('first_last@example.com'), 'first\\_last@example.com');
  assertEquals(escapeLikePattern('100%@example.com'), '100\\%@example.com');
  assertEquals(escapeLikePattern('back\\slash@example.com'), 'back\\\\slash@example.com');
});

// ---------------------------------------------------------------------------
// Picking the most relevant existing row for an email
// ---------------------------------------------------------------------------

Deno.test('pickGuestDuplicate: null when there are no rows', () => {
  assertEquals(pickGuestDuplicate([]), null);
});

Deno.test('pickGuestDuplicate: confirmed ticket wins over a later failed attempt', () => {
  const rows = [
    { id: 'a', payment_status: 'failed', updated_at: minutesAgo(1) },
    { id: 'b', payment_status: 'paid', updated_at: minutesAgo(60) },
  ];
  assertEquals(pickGuestDuplicate(rows)?.id, 'b');
});

Deno.test('pickGuestDuplicate: priority paid/free > approved_waitlist > pending_stk > waitlisted > failed', () => {
  const statuses = ['failed', 'waitlisted', 'pending_stk', 'approved_waitlist', 'free'];
  const rows = statuses.map((s, i) => ({ id: s, payment_status: s, updated_at: minutesAgo(i) }));
  assertEquals(pickGuestDuplicate(rows)?.id, 'free');
  assertEquals(pickGuestDuplicate(rows.filter(r => r.id !== 'free'))?.id, 'approved_waitlist');
  assertEquals(pickGuestDuplicate(rows.filter(r => !['free', 'approved_waitlist'].includes(r.id)))?.id, 'pending_stk');
});

// ---------------------------------------------------------------------------
// Duplicate resolution for guests
// ---------------------------------------------------------------------------

Deno.test('resolveGuestDuplicate: no existing row → proceed', () => {
  assertEquals(resolveGuestDuplicate(null, NOW), 'none');
});

Deno.test('resolveGuestDuplicate: failed row → retry in place', () => {
  assertEquals(resolveGuestDuplicate({ payment_status: 'failed', updated_at: minutesAgo(1) }, NOW), 'retry_failed');
});

Deno.test('resolveGuestDuplicate: waitlisted row → re-check capacity', () => {
  assertEquals(resolveGuestDuplicate({ payment_status: 'waitlisted', updated_at: minutesAgo(1) }, NOW), 'waitlisted');
});

Deno.test('resolveGuestDuplicate: confirmed row, not recently touched → resend ticket', () => {
  for (const s of ['free', 'paid']) {
    assertEquals(resolveGuestDuplicate({ payment_status: s, updated_at: minutesAgo(30) }, NOW), 'resend_ticket');
  }
});

Deno.test('resolveGuestDuplicate: confirmed row touched within cooldown → no resend (anti-spam)', () => {
  const recent = new Date(NOW.getTime() - TICKET_RESEND_COOLDOWN_MS + 1000).toISOString();
  assertEquals(resolveGuestDuplicate({ payment_status: 'paid', updated_at: recent }, NOW), 'already_registered');
});

Deno.test('resolveGuestDuplicate: pending STK → payment in progress', () => {
  assertEquals(resolveGuestDuplicate({ payment_status: 'pending_stk', updated_at: minutesAgo(1) }, NOW), 'payment_in_progress');
});

Deno.test('resolveGuestDuplicate: approved_waitlist by email alone → must use the emailed resume link', () => {
  assertEquals(resolveGuestDuplicate({ payment_status: 'approved_waitlist', updated_at: minutesAgo(1) }, NOW), 'use_resume_link');
});

// ---------------------------------------------------------------------------
// Responses — guests must never receive someone else's ticket_code
// ---------------------------------------------------------------------------

Deno.test('guestDuplicateResponse: proceeding actions produce no response', () => {
  for (const a of ['none', 'retry_failed', 'waitlisted'] as const) {
    assertEquals(guestDuplicateResponse(a), null);
  }
});

Deno.test('guestDuplicateResponse: blocking actions are 409 and never include ticket_code', () => {
  for (const a of ['resend_ticket', 'already_registered', 'payment_in_progress', 'use_resume_link'] as const) {
    const res = guestDuplicateResponse(a);
    assert(res, a);
    assertEquals(res.status, 409);
    assertFalse('ticket_code' in res.body, `${a} leaked ticket_code`);
    assert(res.body.error.length > 0);
  }
});

Deno.test('guestDuplicateResponse: resend tells the user to check their email', () => {
  assert(guestDuplicateResponse('resend_ticket')!.body.error.toLowerCase().includes('email'));
});

// ---------------------------------------------------------------------------
// Approved-waitlist resume link
// ---------------------------------------------------------------------------

Deno.test('validateResumeRow: accepts an approved_waitlist row for the same event', () => {
  assertEquals(validateResumeRow({ event_id: 'e1', payment_status: 'approved_waitlist', group_lead_id: null }, 'e1'), null);
});

Deno.test('validateResumeRow: rejects missing row', () => {
  assert(validateResumeRow(null, 'e1'));
});

Deno.test('validateResumeRow: rejects a row from another event', () => {
  assert(validateResumeRow({ event_id: 'e2', payment_status: 'approved_waitlist', group_lead_id: null }, 'e1'));
});

Deno.test('validateResumeRow: rejects rows that are not awaiting payment', () => {
  for (const s of ['waitlisted', 'paid', 'free', 'pending_stk', 'failed']) {
    assert(validateResumeRow({ event_id: 'e1', payment_status: s, group_lead_id: null }, 'e1'), s);
  }
});

Deno.test('validateResumeRow: rejects group member rows', () => {
  assert(validateResumeRow({ event_id: 'e1', payment_status: 'approved_waitlist', group_lead_id: 'lead' }, 'e1'));
});
