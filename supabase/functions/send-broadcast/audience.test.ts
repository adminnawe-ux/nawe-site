/**
 * Tests for broadcast audience building (event attendees + merging).
 * Imports the real module.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/send-broadcast/audience.test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  ATTENDEE_STATUSES,
  buildEventRecipients,
  firstNameFromFullName,
  mergeAllRecipients,
  parseEventId,
  type Recipient,
} from './audience.ts';

const EVENT = '134033b7-d2b6-4dab-9fbc-e6ce36b27e28';

// ---------------------------------------------------------------------------
// firstNameFromFullName
// ---------------------------------------------------------------------------

Deno.test('firstNameFromFullName: first word of the name typed at registration', () => {
  assertEquals(firstNameFromFullName('Jane Wanjiku'), 'Jane');
  assertEquals(firstNameFromFullName('  Brian   Otieno Kamau '), 'Brian');
  assertEquals(firstNameFromFullName('Amina'), 'Amina');
});

Deno.test('firstNameFromFullName: blank / missing → null (merge tag falls back to "there")', () => {
  assertEquals(firstNameFromFullName(''), null);
  assertEquals(firstNameFromFullName('   '), null);
  assertEquals(firstNameFromFullName(null), null);
});

// ---------------------------------------------------------------------------
// parseEventId
// ---------------------------------------------------------------------------

Deno.test('parseEventId: absent → no event audience', () => {
  assertEquals(parseEventId(undefined), { eventId: null });
  assertEquals(parseEventId(null), { eventId: null });
  assertEquals(parseEventId(''), { eventId: null });
});

Deno.test('parseEventId: valid uuid', () => {
  assertEquals(parseEventId(EVENT), { eventId: EVENT });
});

Deno.test('parseEventId: rejects junk', () => {
  for (const bad of ['abc', 42, [EVENT], { id: EVENT }, `${EVENT}' or 1=1`]) {
    assert('error' in parseEventId(bad), JSON.stringify(bad));
  }
});

// ---------------------------------------------------------------------------
// buildEventRecipients
// ---------------------------------------------------------------------------

Deno.test('ATTENDEE_STATUSES: only confirmed registrations', () => {
  assertEquals([...ATTENDEE_STATUSES].sort(), ['free', 'paid']);
});

Deno.test('buildEventRecipients: maps registrations to recipients with first names', () => {
  const out = buildEventRecipients(
    [
      { attendee_email: 'jane@example.com', attendee_name: 'Jane Wanjiku', user_id: null },
      { attendee_email: 'member@example.com', attendee_name: 'Mo Ali', user_id: 'u1' },
    ],
    new Set(), new Set(),
  );
  assertEquals(out, [
    { email: 'jane@example.com', user_id: null, subscriber_id: null, first_name: 'Jane' },
    { email: 'member@example.com', user_id: 'u1', subscriber_id: null, first_name: 'Mo' },
  ]);
});

Deno.test('buildEventRecipients: de-duplicates by case-insensitive email', () => {
  const out = buildEventRecipients(
    [
      { attendee_email: 'Jane@Example.com', attendee_name: 'Jane', user_id: null },
      { attendee_email: 'jane@example.com', attendee_name: 'Jane W', user_id: null },
    ],
    new Set(), new Set(),
  );
  assertEquals(out.length, 1);
});

Deno.test('buildEventRecipients: drops users who opted out of broadcasts', () => {
  const out = buildEventRecipients(
    [{ attendee_email: 'member@example.com', attendee_name: 'Mo', user_id: 'u1' }],
    new Set(['u1']), new Set(),
  );
  assertEquals(out, []);
});

Deno.test('buildEventRecipients: drops guests who unsubscribed (suppression list, case-insensitive)', () => {
  const out = buildEventRecipients(
    [
      { attendee_email: 'Gone@Example.com', attendee_name: 'Gone', user_id: null },
      { attendee_email: 'stay@example.com', attendee_name: 'Stay', user_id: null },
    ],
    new Set(), new Set(['gone@example.com']),
  );
  assertEquals(out.map((r) => r.email), ['stay@example.com']);
});

Deno.test('buildEventRecipients: skips rows with an empty email', () => {
  const out = buildEventRecipients(
    [{ attendee_email: '  ', attendee_name: 'X', user_id: null }],
    new Set(), new Set(),
  );
  assertEquals(out, []);
});

// ---------------------------------------------------------------------------
// mergeAllRecipients
// ---------------------------------------------------------------------------

const reg = (email: string, first_name: string | null, user_id = 'u-' + email): Recipient =>
  ({ email, user_id, subscriber_id: null, first_name });
const sub = (email: string, id = 's-' + email): Recipient =>
  ({ email, user_id: null, subscriber_id: id, first_name: null });
const att = (email: string, first_name: string | null, user_id: string | null = null): Recipient =>
  ({ email, user_id, subscriber_id: null, first_name });

Deno.test('mergeAllRecipients: one email per person across all audiences', () => {
  const out = mergeAllRecipients(
    [reg('a@x.com', 'Ann')],
    [sub('A@x.com'), sub('b@x.com')],
    [att('a@x.com', 'Annie'), att('B@X.com', 'Ben'), att('c@x.com', null)],
  );
  assertEquals(out.length, 3);
});

Deno.test('mergeAllRecipients: profile name wins, then attendee name; ids are combined', () => {
  const out = mergeAllRecipients(
    [reg('a@x.com', 'Ann', 'u1')],
    [sub('a@x.com', 's1'), sub('b@x.com', 's2')],
    [att('a@x.com', 'Annie'), att('b@x.com', 'Ben')],
  );
  const a = out.find((r) => r.email.toLowerCase() === 'a@x.com')!;
  const b = out.find((r) => r.email.toLowerCase() === 'b@x.com')!;
  assertEquals(a, { email: 'a@x.com', user_id: 'u1', subscriber_id: 's1', first_name: 'Ann' });
  // Newsletter subscriber who attended: keeps subscriber_id (for unsubscribe) and gains the attendee's name
  assertEquals(b, { email: 'b@x.com', user_id: null, subscriber_id: 's2', first_name: 'Ben' });
});

Deno.test('mergeAllRecipients: registered user without a profile name falls back to the attendee name', () => {
  const out = mergeAllRecipients([reg('a@x.com', null, 'u1')], [], [att('a@x.com', 'Annie', 'u1')]);
  assertEquals(out[0].first_name, 'Annie');
});

Deno.test('mergeAllRecipients: existing behaviour unchanged without an event audience', () => {
  const out = mergeAllRecipients([reg('a@x.com', 'Ann', 'u1')], [sub('a@x.com', 's1'), sub('b@x.com', 's2')], []);
  assertEquals(out.length, 2);
  assertEquals(out.find((r) => r.email === 'a@x.com')?.user_id, 'u1');
});
