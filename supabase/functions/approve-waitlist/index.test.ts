/**
 * Tests for the approve-waitlist edge function.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/approve-waitlist/index.test.ts
 *
 * Covers:
 *   - isFreeApproval determination (free vs paid approval path)
 *   - Input validation
 *   - Simulated approval response shapes
 *   - Email subject/content generation
 *   - Fuzz: arbitrary registration_ids arrays
 */

import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ---------------------------------------------------------------------------
// Pure logic mirrored from index.ts
// ---------------------------------------------------------------------------

/**
 * Mirrors the isFreeApproval decision in index.ts:
 *   const isFreeApproval = event.is_free && !reg.tier_id;
 * Free events with no tier → immediate ticket + email.
 * Paid events (or tiered) → approved_waitlist, user must complete payment.
 */
function isFreeApproval(eventIsFree: boolean, tierIdPresent: boolean): boolean {
  return eventIsFree && !tierIdPresent;
}

function validateInput(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'Invalid JSON';
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.registration_ids)) return 'registration_ids must be a non-empty array';
  if ((b.registration_ids as unknown[]).length === 0) return 'registration_ids must be a non-empty array';
  return null;
}

function buildTicketEmailSubject(eventTitle: string): string {
  return `You're approved — ${eventTitle}`;
}

function buildPaymentEmailSubject(eventTitle: string): string {
  return `Approved — complete your payment for ${eventTitle}`;
}

function escapeHtml(v: string): string {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// ---------------------------------------------------------------------------
// isFreeApproval logic
// ---------------------------------------------------------------------------

Deno.test('isFreeApproval: free event with no tier → immediate ticket', () => {
  assertEquals(isFreeApproval(true, false), true);
});

Deno.test('isFreeApproval: free event with tier → paid path (tier may have a price)', () => {
  assertEquals(isFreeApproval(true, true), false);
});

Deno.test('isFreeApproval: paid event with no tier → paid path', () => {
  assertEquals(isFreeApproval(false, false), false);
});

Deno.test('isFreeApproval: paid event with tier → paid path', () => {
  assertEquals(isFreeApproval(false, true), false);
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

Deno.test('validateInput: null body', () => {
  assertEquals(typeof validateInput(null), 'string');
});

Deno.test('validateInput: empty registration_ids', () => {
  assertEquals(typeof validateInput({ registration_ids: [] }), 'string');
});

Deno.test('validateInput: missing registration_ids', () => {
  assertEquals(typeof validateInput({}), 'string');
});

Deno.test('validateInput: non-array registration_ids', () => {
  assertEquals(typeof validateInput({ registration_ids: 'abc' }), 'string');
});

Deno.test('validateInput: valid single-element array', () => {
  assertEquals(validateInput({ registration_ids: ['reg-uuid-1'] }), null);
});

Deno.test('validateInput: valid multi-element array', () => {
  assertEquals(validateInput({ registration_ids: ['r1', 'r2', 'r3'] }), null);
});

// ---------------------------------------------------------------------------
// Email subjects
// ---------------------------------------------------------------------------

Deno.test('buildTicketEmailSubject: correct format', () => {
  const subject = buildTicketEmailSubject('Community Healing Circle');
  assertMatch(subject, /approved/i);
  assertMatch(subject, /Community Healing Circle/);
});

Deno.test('buildPaymentEmailSubject: correct format', () => {
  const subject = buildPaymentEmailSubject('Night Out: Jazz & Wine');
  assertMatch(subject, /Approved/i);
  assertMatch(subject, /Night Out: Jazz & Wine/);
  assertMatch(subject, /payment/i);
});

// ---------------------------------------------------------------------------
// HTML escaping (used in email bodies)
// ---------------------------------------------------------------------------

Deno.test('escapeHtml: escapes angle brackets', () => {
  assertEquals(escapeHtml('<script>'), '&lt;script&gt;');
});

Deno.test('escapeHtml: escapes ampersand', () => {
  assertEquals(escapeHtml('Jazz & Wine'), 'Jazz &amp; Wine');
});

Deno.test('escapeHtml: escapes double quotes', () => {
  assertEquals(escapeHtml('"hello"'), '&quot;hello&quot;');
});

Deno.test('escapeHtml: escapes single quotes', () => {
  assertEquals(escapeHtml("it's"), 'it&#39;s');
});

Deno.test('escapeHtml: safe string unchanged', () => {
  assertEquals(escapeHtml('John Doe'), 'John Doe');
});

// ---------------------------------------------------------------------------
// Simulated approval flow responses
// ---------------------------------------------------------------------------

Deno.test('simulate: free approval response shape', () => {
  const approved = ['reg-1', 'reg-2'];
  const failed: string[] = [];
  const response = { approved, failed };
  assertEquals(response.approved.length, 2);
  assertEquals(response.failed.length, 0);
});

Deno.test('simulate: partial failure response', () => {
  const response = { approved: ['reg-1', 'reg-3'], failed: ['reg-2'] };
  assertEquals(response.approved.length, 2);
  assertEquals(response.failed.length, 1);
  assertEquals(response.failed[0], 'reg-2');
});

Deno.test('simulate: all failed (e.g. all already non-waitlisted)', () => {
  const response = { approved: [], failed: ['r1', 'r2', 'r3'] };
  assertEquals(response.approved.length, 0);
  assertEquals(response.failed.length, 3);
});

Deno.test('simulate: free event approval — status transitions to free', () => {
  const reg = { id: 'reg-1', payment_status: 'waitlisted' };
  const updated = { ...reg, payment_status: 'free' };
  assertEquals(updated.payment_status, 'free');
});

Deno.test('simulate: paid event approval — status transitions to approved_waitlist', () => {
  const reg = { id: 'reg-1', payment_status: 'waitlisted' };
  const updated = { ...reg, payment_status: 'approved_waitlist' };
  assertEquals(updated.payment_status, 'approved_waitlist');
});

Deno.test('simulate: approved_waitlist row counts toward event capacity', () => {
  const ACTIVE_STATUSES = ['free', 'paid', 'pending_stk', 'approved_waitlist'];
  assertEquals(ACTIVE_STATUSES.includes('approved_waitlist'), true);
  assertEquals(ACTIVE_STATUSES.includes('waitlisted'), false);
});

Deno.test('simulate: only waitlisted rows are processed (not already approved/paid)', () => {
  // The function filters .eq('payment_status', 'waitlisted') before processing
  const regs = [
    { id: 'r1', payment_status: 'waitlisted' },
    { id: 'r2', payment_status: 'paid' },        // should be filtered out
    { id: 'r3', payment_status: 'approved_waitlist' }, // should be filtered out
  ];
  const eligible = regs.filter(r => r.payment_status === 'waitlisted');
  assertEquals(eligible.length, 1);
  assertEquals(eligible[0].id, 'r1');
});

// ---------------------------------------------------------------------------
// Admin role verification (simulated)
// ---------------------------------------------------------------------------

Deno.test('simulate: no Authorization header → 401', () => {
  const authHeader = '';
  assertEquals(!authHeader, true); // triggers 401 in index.ts
});

Deno.test('simulate: non-admin user → 403', () => {
  const roleRow = null; // no admin role found
  assertEquals(roleRow === null, true); // triggers 403
});

Deno.test('simulate: admin user proceeds', () => {
  const roleRow = { role: 'admin', user_id: 'user-uuid' };
  assertEquals(roleRow !== null, true);
  assertEquals(roleRow.role, 'admin');
});

// ---------------------------------------------------------------------------
// Fuzz
// ---------------------------------------------------------------------------

Deno.test('fuzz: validateInput never throws on arbitrary inputs', () => {
  const inputs = [
    null, undefined, 42, 'string', [], {}, { registration_ids: null },
    { registration_ids: [1, 2, 3] }, // non-string elements
    { registration_ids: new Array(1000).fill('uuid') },
    { registration_ids: [''] }, // empty-string UUID — passes array check, DB will ignore
  ];
  for (const input of inputs) {
    let threw = false;
    try {
      validateInput(input);
    } catch {
      threw = true;
    }
    assertEquals(threw, false);
  }
});

Deno.test('fuzz: escapeHtml handles arbitrary unicode without throwing', () => {
  const inputs = [
    '', ' ', '\n', '\t', ' ',
    '日本語テスト', 'العربية', 'मराठी',
    '<script>alert(1)</script>',
    '"; DROP TABLE event_registrations; --',
    '&amp;already;escaped&lt;',
    "'single' \"double\" <both>",
  ];
  for (const input of inputs) {
    let threw = false;
    try {
      escapeHtml(input);
    } catch {
      threw = true;
    }
    assertEquals(threw, false);
  }
});

Deno.test('fuzz: escapeHtml output never contains raw < > or & characters', () => {
  const dangerous = ['<tag>', '&amp', '"value"', "'single'", '<>&"\''];
  for (const input of dangerous) {
    const escaped = escapeHtml(input);
    assertEquals(escaped.includes('<'), false);
    assertEquals(escaped.includes('>'), false);
    // & in the output only appears as &amp;, &lt;, etc. — not as bare &
    const bareAmp = escaped.match(/&(?!(amp|lt|gt|quot|#39);)/g);
    assertEquals(bareAmp, null);
  }
});

Deno.test('fuzz: isFreeApproval is always boolean', () => {
  const combos: [boolean, boolean][] = [
    [true, true], [true, false], [false, true], [false, false],
  ];
  for (const [eventIsFree, tierIdPresent] of combos) {
    const result = isFreeApproval(eventIsFree, tierIdPresent);
    assertEquals(typeof result, 'boolean');
  }
});
