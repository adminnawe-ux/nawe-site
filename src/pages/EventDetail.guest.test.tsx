/**
 * Regression tests for guest (signed-out) event registration on EventDetail.
 *
 * Supabase and auth are mocked; these exercise the real component.
 */
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const authState: { user: { id: string; email: string } | null } = { user: null };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user, session: null, roles: [], loading: false }),
}));

// Per-table results for the chained query builder
const tableData: Record<string, unknown> = {};
function chain(table: string) {
  const result = { data: tableData[table] ?? null, count: 0, error: null };
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) c[m] = () => c;
  c.maybeSingle = () => Promise.resolve(result);
  c.single = () => Promise.resolve(result);
  c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
  return c;
}

const invoke = vi.fn();
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => chain(t),
    rpc: (...args: unknown[]) => rpc(...args),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

import EventDetail from './EventDetail';

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
const baseEvent = {
  id: 'evt-1', slug: 'open-day', title: 'Open Day', description: null, poster_url: null,
  organizer_name: null, location: 'Nairobi', location_url: null, starts_at: FUTURE, ends_at: null,
  is_free: true, price: null, currency: 'KES', capacity: 50, status: 'published',
};
const paidTier = {
  id: 'tier-1', event_id: 'evt-1', name: 'Regular', ticket_type: 'individual', group_size: null,
  price: 1000, currency: 'KES', capacity: null, sale_starts_at: null, sale_ends_at: null, sort_order: 0,
};

function renderAt(path = '/events/open-day') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/events/:slug" element={<EventDetail />} /></Routes>
    </MemoryRouter>,
  );
}

function fillDetails(name = 'Jane Guest', email = 'jane@example.com') {
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
}

describe('EventDetail — guest registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    tableData.events = { ...baseEvent };
    tableData.event_ticket_tiers = [];
    tableData.event_registrations = null;
    rpc.mockResolvedValue({ data: { total: 0, tiers: {} }, error: null });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('opens the registration form for a signed-out visitor instead of redirecting to /login', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /register — free/i }));
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/login'));
    expect(await screen.findByPlaceholderText('Your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('registers a guest for a free event with just name + email and shows the ticket', async () => {
    invoke.mockResolvedValue({ data: { ticket_code: 'ABCD1234' }, error: null });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /register — free/i }));
    fillDetails();
    fireEvent.click(screen.getByRole('button', { name: /confirm registration/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('register-event', expect.anything()));
    const [, opts] = invoke.mock.calls.find(c => c[0] === 'register-event')!;
    expect(opts.body).toMatchObject({ event_id: 'evt-1', attendee_name: 'Jane Guest', attendee_email: 'jane@example.com' });
    expect(opts.headers).toBeUndefined();
    expect(await screen.findByText(/you're registered!/i)).toBeInTheDocument();
  });

  it('polls payment status for a guest even without a session token', async () => {
    tableData.events = { ...baseEvent, is_free: false };
    tableData.event_ticket_tiers = [paidTier];
    invoke.mockImplementation((fn: string) => Promise.resolve(fn === 'register-event'
      ? { data: { registration_id: 'reg-1', transaction_id: 'TXN-1' }, error: null }
      : { data: { status: 'confirmed', ticket_code: 'PAID1234' }, error: null }));

    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /get tickets/i }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByText('Regular'));
    fillDetails();
    fireEvent.change(screen.getByPlaceholderText('07XXXXXXXX'), { target: { value: '0712345678' } });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole('button', { name: /send m-pesa prompt/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('register-event', expect.anything()));
    await act(async () => { await vi.advanceTimersByTimeAsync(4500); });

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('query-event-payment', expect.objectContaining({
      body: { transaction_id: 'TXN-1', registration_id: 'reg-1' },
    })));
    expect(await screen.findByText(/you're registered!/i)).toBeInTheDocument();
  });

  it('shows remaining spots from the availability RPC (RLS hides other people\'s rows)', async () => {
    rpc.mockResolvedValue({ data: { total: 45, tiers: {} }, error: null });
    renderAt();
    expect(await screen.findByText('5 spots left')).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('get_event_availability', { p_event_id: 'evt-1' });
  });

  it('lets an approved-waitlist guest complete payment from the emailed ?resume= link', async () => {
    const resumeId = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
    tableData.events = { ...baseEvent, is_free: false };
    tableData.event_ticket_tiers = [paidTier];
    invoke.mockImplementation((_fn: string, opts: { body: Record<string, unknown> }) => Promise.resolve(
      opts.body.action === 'resume_lookup'
        ? { data: { tier_id: 'tier-1', attendee_name: 'Jane Guest', attendee_email: 'jane@example.com' }, error: null }
        : { data: { registration_id: resumeId, transaction_id: 'TXN-9' }, error: null },
    ));

    renderAt(`/events/open-day?resume=${resumeId}`);
    fireEvent.click(await screen.findByRole('button', { name: /complete payment/i }));
    expect(await screen.findByDisplayValue('Jane Guest')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('07XXXXXXXX'), { target: { value: '0712345678' } });
    fireEvent.click(screen.getByRole('button', { name: /send m-pesa prompt/i }));

    await waitFor(() => {
      const call = invoke.mock.calls.find(c => c[0] === 'register-event' && !c[1].body.action);
      expect(call?.[1].body).toMatchObject({ resume_registration_id: resumeId, tier_id: 'tier-1' });
    });
  });

  it('still prefills the email for signed-in users', async () => {
    authState.user = { id: 'u1', email: 'member@example.com' };
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /register — free/i }));
    expect(await screen.findByDisplayValue('member@example.com')).toBeInTheDocument();
  });
});
