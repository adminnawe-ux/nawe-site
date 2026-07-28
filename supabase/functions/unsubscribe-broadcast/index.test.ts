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

const SECRET = 'test-secret';

interface UnsubscribeToken {
  u: string | null;
  s: string | null;
  e: string;
}

function toBase64Url(bytes: ArrayBuffer) {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(str: string) {
  const b64 = str.replaceAll('-', '+').replaceAll('_', '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]
  );
}

async function signToken(payloadObj: UnsubscribeToken, secret: string) {
  const payload = btoa(JSON.stringify(payloadObj));
  const key = await hmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

async function decodeUnsubscribeToken(token: string, secret: string): Promise<UnsubscribeToken | null> {
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !secret) return null;

  try {
    const key = await hmacKey(secret, 'verify');
    const valid = await crypto.subtle.verify(
      'HMAC', key, fromBase64Url(signature), new TextEncoder().encode(payload)
    );
    if (!valid) return null;

    const parsed = JSON.parse(atob(payload));
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.e !== 'string') return null;
    return { u: parsed.u ?? null, s: parsed.s ?? null, e: parsed.e };
  } catch {
    return null;
  }
}

Deno.test('decodeUnsubscribeToken: decodes a validly-signed registered-user token', async () => {
  const token = await signToken({ u: 'user-1', s: null, e: 'a@example.com' }, SECRET);
  assertEquals(await decodeUnsubscribeToken(token, SECRET), { u: 'user-1', s: null, e: 'a@example.com' });
});

Deno.test('decodeUnsubscribeToken: decodes a validly-signed newsletter-subscriber token', async () => {
  const token = await signToken({ u: null, s: 'sub-1', e: 'b@example.com' }, SECRET);
  assertEquals(await decodeUnsubscribeToken(token, SECRET), { u: null, s: 'sub-1', e: 'b@example.com' });
});

Deno.test('decodeUnsubscribeToken: rejects a forged token with no signature', async () => {
  const payload = btoa(JSON.stringify({ u: 'victim-user-id', s: null, e: 'attacker@example.com' }));
  assertEquals(await decodeUnsubscribeToken(payload, SECRET), null);
});

Deno.test('decodeUnsubscribeToken: rejects a token signed with the wrong secret', async () => {
  const token = await signToken({ u: 'victim-user-id', s: null, e: 'attacker@example.com' }, 'wrong-secret');
  assertEquals(await decodeUnsubscribeToken(token, SECRET), null);
});

Deno.test('decodeUnsubscribeToken: rejects a tampered payload even with a trailing signature', async () => {
  const token = await signToken({ u: 'user-1', s: null, e: 'a@example.com' }, SECRET);
  const [, signature] = token.split('.');
  const forgedPayload = btoa(JSON.stringify({ u: 'victim-user-id', s: null, e: 'a@example.com' }));
  assertEquals(await decodeUnsubscribeToken(`${forgedPayload}.${signature}`, SECRET), null);
});

Deno.test('decodeUnsubscribeToken: rejects malformed base64 payload', async () => {
  const token = await signToken({ u: 'user-1', s: null, e: 'a@example.com' }, SECRET);
  const [, signature] = token.split('.');
  assertEquals(await decodeUnsubscribeToken(`not-valid-base64!!!.${signature}`, SECRET), null);
});

Deno.test('decodeUnsubscribeToken: rejects a token missing the email field', async () => {
  const token = await signToken({ u: 'user-1', s: null, e: undefined as unknown as string }, SECRET);
  assertEquals(await decodeUnsubscribeToken(token, SECRET), null);
});

Deno.test('decodeUnsubscribeToken: defaults missing u/s fields to null', async () => {
  const payload = btoa(JSON.stringify({ e: 'c@example.com' }));
  const key = await hmacKey(SECRET, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const token = `${payload}.${toBase64Url(signature)}`;
  assertEquals(await decodeUnsubscribeToken(token, SECRET), { u: null, s: null, e: 'c@example.com' });
});
