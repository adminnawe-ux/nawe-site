/**
 * Tests for what an unsubscribe token does. Imports the real module.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/unsubscribe-broadcast/actions.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { unsubscribeActions } from './actions.ts';

Deno.test('unsubscribeActions: registered user → profile opt-out only', () => {
  assertEquals(unsubscribeActions({ u: 'u1', s: null, e: 'a@x.com' }), {
    optOutUserId: 'u1', unsubscribeSubscriberId: null, suppressEmail: null,
  });
});

Deno.test('unsubscribeActions: newsletter subscriber → newsletter unsubscribe only', () => {
  assertEquals(unsubscribeActions({ u: null, s: 's1', e: 'a@x.com' }), {
    optOutUserId: null, unsubscribeSubscriberId: 's1', suppressEmail: null,
  });
});

Deno.test('unsubscribeActions: user who is also a subscriber → both', () => {
  assertEquals(unsubscribeActions({ u: 'u1', s: 's1', e: 'a@x.com' }), {
    optOutUserId: 'u1', unsubscribeSubscriberId: 's1', suppressEmail: null,
  });
});

// Regression: previously a token with neither id did nothing but reported success.
Deno.test('unsubscribeActions: guest event attendee (no account, no subscription) → email suppression', () => {
  assertEquals(unsubscribeActions({ u: null, s: null, e: '  Guest@Example.COM ' }), {
    optOutUserId: null, unsubscribeSubscriberId: null, suppressEmail: 'guest@example.com',
  });
});

Deno.test('unsubscribeActions: guest token with blank email → nothing to do', () => {
  assertEquals(unsubscribeActions({ u: null, s: null, e: '  ' }), {
    optOutUserId: null, unsubscribeSubscriberId: null, suppressEmail: null,
  });
});
