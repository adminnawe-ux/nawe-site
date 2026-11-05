import { describe, it, expect } from 'vitest';
import {
  authHeaders,
  getResumeRegistrationId,
  paymentStillPendingMessage,
} from './eventRegistration';

describe('authHeaders', () => {
  it('attaches a bearer token when signed in', () => {
    expect(authHeaders('abc')).toEqual({ Authorization: 'Bearer abc' });
  });

  it('returns undefined for guests so supabase-js falls back to the anon key', () => {
    expect(authHeaders(null)).toBeUndefined();
    expect(authHeaders(undefined)).toBeUndefined();
    expect(authHeaders('')).toBeUndefined();
  });
});

describe('getResumeRegistrationId', () => {
  const id = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

  it('reads a valid uuid from ?resume=', () => {
    expect(getResumeRegistrationId(`?resume=${id}`)).toBe(id);
  });

  it('ignores missing or malformed values', () => {
    expect(getResumeRegistrationId('')).toBeNull();
    expect(getResumeRegistrationId('?resume=')).toBeNull();
    expect(getResumeRegistrationId('?resume=not-a-uuid')).toBeNull();
    expect(getResumeRegistrationId(`?resume=${id}' or 1=1`)).toBeNull();
  });
});

describe('paymentStillPendingMessage', () => {
  it('points signed-in users to their dashboard', () => {
    expect(paymentStillPendingMessage(false)).toMatch(/your tickets/i);
  });

  it('tells guests the ticket will be emailed (they have no dashboard)', () => {
    const msg = paymentStillPendingMessage(true);
    expect(msg).toMatch(/email/i);
    expect(msg).not.toMatch(/dashboard/i);
  });
});
