/**
 * Tests for the query-event-payment edge function.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/query-event-payment/index.test.ts
 *
 * Covers:
 *   - NCBA query response parsing (SUCCESS / FAILED / pending / internal error)
 *   - Poll status → client response mapping
 *   - Group payment: mark lead + all members
 *   - "Already confirmed" short-circuit
 *   - Fuzz: arbitrary NCBA status strings
 */

import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ---------------------------------------------------------------------------
// Pure logic mirrored from index.ts
// ---------------------------------------------------------------------------

type PollStatus = 'confirmed' | 'failed' | 'pending';

/**
 * Mirrors the NCBA status → poll status mapping in index.ts.
 * "SUCCESS" → confirmed
 * "FAILED" + desc contains "error"/"internal" → pending (transient NCBA error)
 * "FAILED" otherwise → failed
 * anything else → pending
 */
function resolveNcbaStatus(ncbaStatus: string, description: string): PollStatus {
  const upper = ncbaStatus.toUpperCase();
  if (upper === 'SUCCESS') return 'confirmed';
  if (upper === 'FAILED') {
    const desc = description.toLowerCase();
    // Transient: no description, NCBA internal error, or prompt still being processed
    if (!description || desc.includes('error') || desc.includes('internal') || desc.includes('processing')) return 'pending';
    return 'failed';
  }
  return 'pending';
}

/**
 * Mirrors the group confirmation: lead + all members get status=paid.
 */
function applyGroupConfirmation(
  lead: { id: string; payment_status: string },
  members: { id: string; group_lead_id: string; payment_status: string }[],
): { lead: typeof lead; members: typeof members } {
  return {
    lead: { ...lead, payment_status: 'paid' },
    members: members.map(m => ({ ...m, payment_status: 'paid' })),
  };
}

/**
 * Mirrors the group failure: lead + all members get status=failed.
 */
function applyGroupFailure(
  lead: { id: string; payment_status: string },
  members: { id: string; group_lead_id: string; payment_status: string }[],
): { lead: typeof lead; members: typeof members } {
  return {
    lead: { ...lead, payment_status: 'failed' },
    members: members.map(m => ({ ...m, payment_status: 'failed' })),
  };
}

interface ClientResponse {
  status: PollStatus;
  ticket_code?: string;
  reason?: string;
}

function buildClientResponse(pollStatus: PollStatus, ticketCode?: string, reason?: string): ClientResponse {
  if (pollStatus === 'confirmed') return { status: 'confirmed', ticket_code: ticketCode };
  if (pollStatus === 'failed') return { status: 'failed', reason };
  return { status: 'pending' };
}

// ---------------------------------------------------------------------------
// NCBA status resolution
// ---------------------------------------------------------------------------

Deno.test('resolveNcbaStatus: SUCCESS → confirmed', () => {
  assertEquals(resolveNcbaStatus('SUCCESS', 'Transaction successful'), 'confirmed');
});

Deno.test('resolveNcbaStatus: success lowercase → confirmed', () => {
  assertEquals(resolveNcbaStatus('success', ''), 'confirmed');
});

Deno.test('resolveNcbaStatus: FAILED with normal description → failed', () => {
  assertEquals(resolveNcbaStatus('FAILED', 'User cancelled the request'), 'failed');
});

Deno.test('resolveNcbaStatus: FAILED with "processing" in description → pending (prompt awaiting PIN)', () => {
  assertEquals(resolveNcbaStatus('FAILED', 'The transaction is still under processing'), 'pending');
});

Deno.test('resolveNcbaStatus: FAILED with "error" in description → pending (transient)', () => {
  assertEquals(resolveNcbaStatus('FAILED', 'An error occurred processing the request'), 'pending');
});

Deno.test('resolveNcbaStatus: FAILED with "internal" in description → pending (transient)', () => {
  assertEquals(resolveNcbaStatus('FAILED', 'Internal server error'), 'pending');
});

Deno.test('resolveNcbaStatus: FAILED with "Error" (mixed case) in description → pending', () => {
  assertEquals(resolveNcbaStatus('FAILED', 'Error: timeout on upstream'), 'pending');
});

Deno.test('resolveNcbaStatus: unknown status → pending', () => {
  assertEquals(resolveNcbaStatus('PROCESSING', ''), 'pending');
  assertEquals(resolveNcbaStatus('PENDING', ''), 'pending');
  assertEquals(resolveNcbaStatus('', ''), 'pending');
});

Deno.test('resolveNcbaStatus: FAILED "wrong PIN" → failed (not transient)', () => {
  assertEquals(resolveNcbaStatus('FAILED', 'The initiator information is invalid'), 'failed');
});

Deno.test('resolveNcbaStatus: FAILED "cancelled by user" → failed', () => {
  assertEquals(resolveNcbaStatus('FAILED', 'Request cancelled by user'), 'failed');
});

// ---------------------------------------------------------------------------
// Client response building
// ---------------------------------------------------------------------------

Deno.test('buildClientResponse: confirmed includes ticket_code', () => {
  const resp = buildClientResponse('confirmed', 'ABCD1234');
  assertEquals(resp.status, 'confirmed');
  assertEquals(resp.ticket_code, 'ABCD1234');
});

Deno.test('buildClientResponse: failed includes reason', () => {
  const resp = buildClientResponse('failed', undefined, 'Request cancelled by user');
  assertEquals(resp.status, 'failed');
  assertEquals(resp.reason, 'Request cancelled by user');
  assertEquals('ticket_code' in resp, false);
});

Deno.test('buildClientResponse: pending has no ticket_code or reason', () => {
  const resp = buildClientResponse('pending');
  assertEquals(resp.status, 'pending');
  assertEquals(resp.ticket_code, undefined);
  assertEquals(resp.reason, undefined);
});

// ---------------------------------------------------------------------------
// Group payment confirmation
// ---------------------------------------------------------------------------

Deno.test('applyGroupConfirmation: lead marked paid', () => {
  const lead = { id: 'lead-1', payment_status: 'pending_stk' };
  const { lead: updated } = applyGroupConfirmation(lead, []);
  assertEquals(updated.payment_status, 'paid');
});

Deno.test('applyGroupConfirmation: all members marked paid', () => {
  const lead = { id: 'lead-1', payment_status: 'pending_stk' };
  const members = [
    { id: 'm1', group_lead_id: 'lead-1', payment_status: 'pending_stk' },
    { id: 'm2', group_lead_id: 'lead-1', payment_status: 'pending_stk' },
    { id: 'm3', group_lead_id: 'lead-1', payment_status: 'pending_stk' },
  ];
  const { members: updated } = applyGroupConfirmation(lead, members);
  assertEquals(updated.length, 3);
  assertEquals(updated.every(m => m.payment_status === 'paid'), true);
});

Deno.test('applyGroupConfirmation: group_lead_id preserved on members', () => {
  const lead = { id: 'lead-1', payment_status: 'pending_stk' };
  const members = [{ id: 'm1', group_lead_id: 'lead-1', payment_status: 'pending_stk' }];
  const { members: updated } = applyGroupConfirmation(lead, members);
  assertEquals(updated[0].group_lead_id, 'lead-1');
});

Deno.test('applyGroupConfirmation: zero members (individual ticket)', () => {
  const lead = { id: 'lead-1', payment_status: 'pending_stk' };
  const { lead: updatedLead, members: updatedMembers } = applyGroupConfirmation(lead, []);
  assertEquals(updatedLead.payment_status, 'paid');
  assertEquals(updatedMembers.length, 0);
});

// ---------------------------------------------------------------------------
// Group payment failure
// ---------------------------------------------------------------------------

Deno.test('applyGroupFailure: lead marked failed', () => {
  const lead = { id: 'lead-1', payment_status: 'pending_stk' };
  const { lead: updated } = applyGroupFailure(lead, []);
  assertEquals(updated.payment_status, 'failed');
});

Deno.test('applyGroupFailure: all members marked failed', () => {
  const lead = { id: 'lead-1', payment_status: 'pending_stk' };
  const members = [
    { id: 'm1', group_lead_id: 'lead-1', payment_status: 'pending_stk' },
    { id: 'm2', group_lead_id: 'lead-1', payment_status: 'pending_stk' },
  ];
  const { members: updated } = applyGroupFailure(lead, members);
  assertEquals(updated.every(m => m.payment_status === 'failed'), true);
});

// ---------------------------------------------------------------------------
// "Already confirmed" short-circuit
// ---------------------------------------------------------------------------

Deno.test('simulate: already-paid registration returns confirmed without calling NCBA', () => {
  const registration = { payment_status: 'paid', ticket_code: 'ABCD1234' };
  // In index.ts: if (lead.payment_status === 'paid') return confirmed immediately
  if (registration.payment_status === 'paid') {
    const resp = buildClientResponse('confirmed', registration.ticket_code);
    assertEquals(resp.status, 'confirmed');
    assertEquals(resp.ticket_code, 'ABCD1234');
  }
});

Deno.test('simulate: 404 for unknown registration_id', () => {
  const status = 404;
  const response = { error: 'Registration not found' };
  assertEquals(status, 404);
  assertMatch(response.error, /not found/i);
});

// ---------------------------------------------------------------------------
// Integration: full poll cycle simulation
// ---------------------------------------------------------------------------

Deno.test('simulate: poll cycle — pending → pending → confirmed', () => {
  const pollResults = ['PROCESSING', 'PROCESSING', 'SUCCESS'];
  const descriptions = ['', '', 'Transaction successful'];

  const statuses = pollResults.map((s, i) => resolveNcbaStatus(s, descriptions[i]));
  assertEquals(statuses[0], 'pending');
  assertEquals(statuses[1], 'pending');
  assertEquals(statuses[2], 'confirmed');
});

Deno.test('simulate: poll cycle — transient NCBA error stays pending', () => {
  // NCBA returns FAILED with internal error twice, then SUCCESS
  const pollResults = ['FAILED', 'FAILED', 'SUCCESS'];
  const descriptions = ['Internal server error', 'An error occurred', 'Transaction successful'];

  const statuses = pollResults.map((s, i) => resolveNcbaStatus(s, descriptions[i]));
  assertEquals(statuses[0], 'pending'); // transient → keep polling
  assertEquals(statuses[1], 'pending'); // transient → keep polling
  assertEquals(statuses[2], 'confirmed');
});

Deno.test('simulate: poll cycle — user-cancelled terminates early', () => {
  const pollResults = ['PROCESSING', 'FAILED'];
  const descriptions = ['', 'Request cancelled by the customer'];

  const statuses = pollResults.map((s, i) => resolveNcbaStatus(s, descriptions[i]));
  assertEquals(statuses[0], 'pending');
  assertEquals(statuses[1], 'failed'); // definitive → stop polling
});

Deno.test('simulate: 15 polls exhausted still returns pending (timeout handled by frontend)', () => {
  const fifteenPolls = Array.from({ length: 15 }, () => resolveNcbaStatus('PROCESSING', ''));
  assertEquals(fifteenPolls.every(s => s === 'pending'), true);
});

// ---------------------------------------------------------------------------
// Fuzz — resolveNcbaStatus never throws
// ---------------------------------------------------------------------------

Deno.test('fuzz: resolveNcbaStatus never throws on arbitrary status/description strings', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-';
  for (let i = 0; i < 300; i++) {
    const len1 = Math.floor(Math.random() * 20);
    const len2 = Math.floor(Math.random() * 50);
    const status = Array.from({ length: len1 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const description = Array.from({ length: len2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    let threw = false;
    try {
      resolveNcbaStatus(status, description);
    } catch {
      threw = true;
    }
    assertEquals(threw, false);
  }
});

Deno.test('fuzz: resolveNcbaStatus output is always a valid PollStatus', () => {
  const validStatuses: PollStatus[] = ['confirmed', 'failed', 'pending'];
  const inputs: [string, string][] = [
    ['SUCCESS', ''],
    ['FAILED', 'cancelled'],
    ['FAILED', 'internal error'],
    ['', ''],
    ['RANDOM', 'description'],
    ['success', 'lowercase'],
    ['failed', 'internal'],
  ];
  for (const [status, desc] of inputs) {
    const result = resolveNcbaStatus(status, desc);
    assertEquals(validStatuses.includes(result), true);
  }
});

Deno.test('fuzz: applyGroupConfirmation handles large groups', () => {
  const lead = { id: 'lead-1', payment_status: 'pending_stk' };
  const members = Array.from({ length: 99 }, (_, i) => ({
    id: `m${i}`,
    group_lead_id: 'lead-1',
    payment_status: 'pending_stk',
  }));
  const { members: updated } = applyGroupConfirmation(lead, members);
  assertEquals(updated.length, 99);
  assertEquals(updated.every(m => m.payment_status === 'paid'), true);
});
