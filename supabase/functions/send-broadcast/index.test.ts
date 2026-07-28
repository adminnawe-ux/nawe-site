/**
 * Tests for the send-broadcast edge function.
 *
 * Pure logic is mirrored here (not imported from index.ts) because importing
 * index.ts would execute its top-level Deno.serve() call.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/send-broadcast/index.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

interface Recipient {
  email: string;
  user_id: string | null;
  subscriber_id: string | null;
  first_name: string | null;
}

function applyMergeTags(body: string, recipient: { first_name: string | null }) {
  return body.replaceAll('{{first_name}}', recipient.first_name?.trim() || 'there');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCcList(raw: string): string[] {
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && EMAIL_RE.test(e));
}

function makeUnsubscribeToken(recipient: { user_id: string | null; subscriber_id: string | null; email: string }) {
  return btoa(JSON.stringify({ u: recipient.user_id, s: recipient.subscriber_id, e: recipient.email }));
}

function mergeRecipients(registered: Recipient[], newsletter: Recipient[]): Recipient[] {
  const byEmail = new Map<string, Recipient>();
  for (const r of newsletter) {
    byEmail.set(r.email.toLowerCase(), r);
  }
  for (const r of registered) {
    byEmail.set(r.email.toLowerCase(), r);
  }
  return [...byEmail.values()];
}

// ---------------------------------------------------------------------------
// applyMergeTags
// ---------------------------------------------------------------------------

Deno.test('applyMergeTags: substitutes {{first_name}} with the recipient name', () => {
  const result = applyMergeTags('<p>Hi {{first_name}},</p>', { first_name: 'Fred' });
  assertEquals(result, '<p>Hi Fred,</p>');
});

Deno.test('applyMergeTags: falls back to "there" when no name is on file', () => {
  const result = applyMergeTags('<p>Hi {{first_name}},</p>', { first_name: null });
  assertEquals(result, '<p>Hi there,</p>');
});

Deno.test('applyMergeTags: falls back to "there" for a blank name', () => {
  const result = applyMergeTags('<p>Hi {{first_name}},</p>', { first_name: '   ' });
  assertEquals(result, '<p>Hi there,</p>');
});

Deno.test('applyMergeTags: replaces every occurrence of the tag', () => {
  const result = applyMergeTags('{{first_name}} and {{first_name}} again', { first_name: 'Ann' });
  assertEquals(result, 'Ann and Ann again');
});

// ---------------------------------------------------------------------------
// parseCcList
// ---------------------------------------------------------------------------

Deno.test('parseCcList: parses a comma-separated list of valid addresses', () => {
  assertEquals(parseCcList('a@example.com, b@example.com'), ['a@example.com', 'b@example.com']);
});

Deno.test('parseCcList: drops blanks and invalid addresses', () => {
  assertEquals(parseCcList('a@example.com, , not-an-email, b@example.com'), ['a@example.com', 'b@example.com']);
});

Deno.test('parseCcList: empty string produces no addresses', () => {
  assertEquals(parseCcList(''), []);
});

// ---------------------------------------------------------------------------
// makeUnsubscribeToken
// ---------------------------------------------------------------------------

Deno.test('makeUnsubscribeToken: round-trips through base64 JSON', () => {
  const token = makeUnsubscribeToken({ user_id: 'user-1', subscriber_id: null, email: 'a@example.com' });
  const decoded = JSON.parse(atob(token));
  assertEquals(decoded, { u: 'user-1', s: null, e: 'a@example.com' });
});

// ---------------------------------------------------------------------------
// mergeRecipients
// ---------------------------------------------------------------------------

Deno.test('mergeRecipients: combines registered and newsletter recipients', () => {
  const registered = [{ email: 'a@example.com', user_id: 'u1', subscriber_id: null, first_name: 'Ann' }];
  const newsletter = [{ email: 'b@example.com', user_id: null, subscriber_id: 's1', first_name: null }];
  const merged = mergeRecipients(registered, newsletter);
  assertEquals(merged.length, 2);
});

Deno.test('mergeRecipients: de-duplicates by lowercased email, preferring the registered-user entry', () => {
  const registered = [{ email: 'Shared@Example.com', user_id: 'u1', subscriber_id: null, first_name: 'Ann' }];
  const newsletter = [{ email: 'shared@example.com', user_id: null, subscriber_id: 's1', first_name: null }];
  const merged = mergeRecipients(registered, newsletter);
  assertEquals(merged.length, 1);
  assertEquals(merged[0].user_id, 'u1');
});

Deno.test('mergeRecipients: empty inputs produce no recipients', () => {
  assertEquals(mergeRecipients([], []).length, 0);
});
