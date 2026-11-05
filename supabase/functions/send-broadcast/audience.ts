// Broadcast audiences: registered users (by role), newsletter subscribers and
// confirmed attendees of one event, merged into one email per person.

export interface Recipient {
  email: string;
  user_id: string | null;
  subscriber_id: string | null;
  first_name: string | null;
}

// Confirmed registrations only — not pending/failed payments or waitlist.
// Group members have their own rows, so they're included.
export const ATTENDEE_STATUSES = ['free', 'paid'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEventId(raw: unknown): { eventId: string | null } | { error: string } {
  if (raw === undefined || raw === null || raw === '') return { eventId: null };
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) return { error: 'event_id must be an event ID' };
  return { eventId: raw };
}

// Registrations store the full name typed at sign-up; greet by its first word.
export function firstNameFromFullName(name: string | null): string | null {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || null;
}

export interface AttendeeRow {
  attendee_email: string;
  attendee_name: string | null;
  user_id: string | null;
}

// optedOutUserIds: profiles with broadcast_opt_out.
// suppressedEmails: lowercased addresses of guests who unsubscribed (broadcast_suppressions).
export function buildEventRecipients(
  rows: AttendeeRow[],
  optedOutUserIds: Set<string>,
  suppressedEmails: Set<string>,
): Recipient[] {
  const byEmail = new Map<string, Recipient>();
  for (const r of rows) {
    const email = r.attendee_email.trim();
    const key = email.toLowerCase();
    if (!email || byEmail.has(key)) continue;
    if (r.user_id ? optedOutUserIds.has(r.user_id) : suppressedEmails.has(key)) continue;
    byEmail.set(key, {
      email, user_id: r.user_id, subscriber_id: null, first_name: firstNameFromFullName(r.attendee_name),
    });
  }
  return [...byEmail.values()];
}

// One entry per lowercased email. Ids are combined so the unsubscribe link
// covers every way we know the person; registered-user details win, and the
// attendee's name fills in when no profile name is on file.
export function mergeAllRecipients(registered: Recipient[], newsletter: Recipient[], attendees: Recipient[]): Recipient[] {
  const byEmail = new Map<string, Recipient>();
  const add = (r: Recipient, preferThis: boolean) => {
    const key = r.email.toLowerCase();
    const prev = byEmail.get(key);
    if (!prev) { byEmail.set(key, { ...r }); return; }
    const [a, b] = preferThis ? [r, prev] : [prev, r];
    byEmail.set(key, {
      email: a.email,
      user_id: a.user_id ?? b.user_id,
      subscriber_id: a.subscriber_id ?? b.subscriber_id,
      first_name: a.first_name ?? b.first_name,
    });
  };
  for (const r of attendees) add(r, false);
  for (const r of newsletter) add(r, true);
  for (const r of registered) add(r, true);
  return [...byEmail.values()];
}
