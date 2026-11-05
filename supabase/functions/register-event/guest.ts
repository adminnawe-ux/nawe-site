// Pure helpers for guest (no-login) event registration.
// Guests are identified by event + email instead of user_id.

// Don't resend a ticket email to the same row more often than this —
// stops the endpoint being used to spam an inbox.
export const TICKET_RESEND_COOLDOWN_MS = 10 * 60 * 1000;

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// For case-insensitive exact match via ILIKE — "_" and "%" are wildcards there.
export function escapeLikePattern(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface GuestExistingRow {
  payment_status: string;
  updated_at: string;
}

const STATUS_PRIORITY = ['paid', 'free', 'approved_waitlist', 'pending_stk', 'waitlisted', 'failed'];

// An email can have several rows for one event (e.g. old failed attempts);
// pick the one that best describes where this person stands.
export function pickGuestDuplicate<T extends GuestExistingRow>(rows: T[]): T | null {
  let best: T | null = null;
  for (const r of rows) {
    const p = STATUS_PRIORITY.indexOf(r.payment_status);
    if (p === -1) continue;
    if (!best || p < STATUS_PRIORITY.indexOf(best.payment_status)) best = r;
  }
  return best;
}

export type GuestDuplicateAction =
  | 'none'
  | 'retry_failed'
  | 'waitlisted'
  | 'resend_ticket'
  | 'already_registered'
  | 'payment_in_progress'
  | 'use_resume_link';

export function resolveGuestDuplicate(existing: GuestExistingRow | null, now: Date): GuestDuplicateAction {
  if (!existing) return 'none';
  switch (existing.payment_status) {
    case 'failed': return 'retry_failed';
    case 'waitlisted': return 'waitlisted';
    case 'pending_stk': return 'payment_in_progress';
    case 'approved_waitlist': return 'use_resume_link';
    case 'free':
    case 'paid': {
      const age = now.getTime() - new Date(existing.updated_at).getTime();
      return age >= TICKET_RESEND_COOLDOWN_MS ? 'resend_ticket' : 'already_registered';
    }
    default: return 'none';
  }
}

// Guests are unauthenticated, so a duplicate response must never reveal the
// existing ticket_code — anyone could type someone else's email.
export function guestDuplicateResponse(action: GuestDuplicateAction): { status: number; body: { error: string } } | null {
  switch (action) {
    case 'resend_ticket':
      return { status: 409, body: { error: "You're already registered for this event. We've re-sent your ticket to your email." } };
    case 'already_registered':
      return { status: 409, body: { error: "You're already registered for this event. Check your email for your ticket." } };
    case 'payment_in_progress':
      return { status: 409, body: { error: 'A payment for this email is already in progress. Check your phone, or try again in a few minutes.' } };
    case 'use_resume_link':
      return { status: 409, body: { error: "You've been approved from the waitlist. Use the link in your approval email to complete payment." } };
    default:
      return null;
  }
}

export interface ResumeRow {
  event_id: string;
  payment_status: string;
  group_lead_id: string | null;
}

// The approval email links to /events/<slug>?resume=<registration_id>.
// The registration id is an unguessable uuid sent only to the attendee.
export function validateResumeRow(row: ResumeRow | null, eventId: string): string | null {
  if (!row || row.event_id !== eventId || row.group_lead_id !== null) {
    return 'This payment link is not valid for this event.';
  }
  if (row.payment_status !== 'approved_waitlist') {
    return 'This payment link has already been used or has expired.';
  }
  return null;
}
