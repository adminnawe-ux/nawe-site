// Helpers for event registration, shared by signed-in and guest flows.

// Guests send no header so supabase-js falls back to the anon key.
export function authHeaders(accessToken: string | null | undefined): Record<string, string> | undefined {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The waitlist approval email links to /events/<slug>?resume=<registration_id>
export function getResumeRegistrationId(search: string): string | null {
  const id = new URLSearchParams(search).get('resume');
  return id && UUID_RE.test(id) ? id : null;
}

export function paymentStillPendingMessage(isGuest: boolean): string {
  return isGuest
    ? "Your payment may still be processing. We'll email your ticket as soon as M-Pesa confirms."
    : 'Your payment may still be processing. Close this and check your tickets in a few minutes.';
}
