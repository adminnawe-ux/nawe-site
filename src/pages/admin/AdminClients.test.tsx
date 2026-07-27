import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminClients from './AdminClients';

interface Row { [key: string]: unknown }

function chainable(rows: Row[]) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.then = (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null });
  return query;
}

const roles = [
  { user_id: 'u-pure', role: 'client' },
  { user_id: 'u-dual-therapist', role: 'client' },
  { user_id: 'u-dual-therapist', role: 'therapist' },
  { user_id: 'u-dual-admin', role: 'client' },
  { user_id: 'u-dual-admin', role: 'admin' },
  { user_id: 'u-therapist-only', role: 'therapist' },
];

const profiles = [
  { user_id: 'u-pure', first_name: 'Pure', last_name: 'Client', phone: '0700', country: 'Kenya', location: 'Nairobi', created_at: '2026-01-01T00:00:00Z' },
  { user_id: 'u-dual-therapist', first_name: 'Dual', last_name: 'Therapist', phone: '0701', country: 'Kenya', location: 'Nairobi', created_at: '2026-01-02T00:00:00Z' },
  { user_id: 'u-dual-admin', first_name: 'Dual', last_name: 'Admin', phone: '0702', country: 'Kenya', location: 'Nairobi', created_at: '2026-01-03T00:00:00Z' },
];

const sessions = [
  { client_id: 'u-pure' },
  { client_id: 'u-pure' },
  { client_id: 'u-dual-therapist' },
];

const intakes = [
  { user_id: 'u-pure', completed: true },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'user_roles') return chainable(roles);
      if (table === 'profiles') return chainable(profiles);
      if (table === 'sessions') return chainable(sessions);
      if (table === 'intake_responses') return chainable(intakes);
      return chainable([]);
    },
  },
}));

describe('AdminClients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a user with only the client role normally, counted in stats', async () => {
    render(<AdminClients />);
    await waitFor(() => expect(screen.getByText('Pure Client')).toBeInTheDocument());
    // Only u-pure is a pure client
    expect(screen.getByText('Total Clients').previousElementSibling?.textContent).toBe('1');
  });

  it('shows a client+therapist user in the table with a badge, excluded from stats', async () => {
    render(<AdminClients />);
    await waitFor(() => expect(screen.getByText('Dual Therapist')).toBeInTheDocument());
    expect(screen.getByText('Also Therapist')).toBeInTheDocument();
  });

  it('shows a client+admin user in the table with a badge, excluded from stats', async () => {
    render(<AdminClients />);
    await waitFor(() => expect(screen.getByText('Dual Admin')).toBeInTheDocument());
    expect(screen.getByText('Also Admin')).toBeInTheDocument();
  });

  it('does not show a user with only therapist role and no client row', async () => {
    render(<AdminClients />);
    await waitFor(() => expect(screen.getByText('Pure Client')).toBeInTheDocument());
    expect(screen.queryByText(/u-therapist-only/)).not.toBeInTheDocument();
  });

  it('computes Total Sessions stat from pure clients only', async () => {
    render(<AdminClients />);
    await waitFor(() => expect(screen.getByText('Pure Client')).toBeInTheDocument());
    // u-pure has 2 sessions; u-dual-therapist's 1 session should be excluded from the stat
    expect(screen.getByText('Total Sessions').previousElementSibling?.textContent).toBe('2');
  });
});
