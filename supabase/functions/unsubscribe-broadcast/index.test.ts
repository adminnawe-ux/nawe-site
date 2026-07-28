/**
 * Tests for the unsubscribe-broadcast edge function.
 *
 * Pure logic is mirrored here (not imported from index.ts) because importing
 * index.ts would execute its top-level Deno.serve() call.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/unsubscribe-broadcast/index.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

interface UnsubscribeToken {
  u: string | null;
  s: string | null;
  e: string;
}

function decodeUnsubscribeToken(token: string): UnsubscribeToken | null {
  try {
    const parsed = JSON.parse(atob(token));
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.e !== 'string') return null;
    return { u: parsed.u ?? null, s: parsed.s ?? null, e: parsed.e };
  } catch {
    return null;
  }
}

Deno.test('decodeUnsubscribeToken: decodes a valid registered-user token', () => {
  const token = btoa(JSON.stringify({ u: 'user-1', s: null, e: 'a@example.com' }));
  assertEquals(decodeUnsubscribeToken(token), { u: 'user-1', s: null, e: 'a@example.com' });
});

Deno.test('decodeUnsubscribeToken: decodes a valid newsletter-subscriber token', () => {
  const token = btoa(JSON.stringify({ u: null, s: 'sub-1', e: 'b@example.com' }));
  assertEquals(decodeUnsubscribeToken(token), { u: null, s: 'sub-1', e: 'b@example.com' });
});

Deno.test('decodeUnsubscribeToken: rejects malformed base64', () => {
  assertEquals(decodeUnsubscribeToken('not-valid-base64!!!'), null);
});

Deno.test('decodeUnsubscribeToken: rejects valid base64 that is not JSON', () => {
  assertEquals(decodeUnsubscribeToken(btoa('just a string')), null);
});

Deno.test('decodeUnsubscribeToken: rejects a token missing the email field', () => {
  const token = btoa(JSON.stringify({ u: 'user-1', s: null }));
  assertEquals(decodeUnsubscribeToken(token), null);
});

Deno.test('decodeUnsubscribeToken: defaults missing u/s fields to null', () => {
  const token = btoa(JSON.stringify({ e: 'c@example.com' }));
  assertEquals(decodeUnsubscribeToken(token), { u: null, s: null, e: 'c@example.com' });
});
