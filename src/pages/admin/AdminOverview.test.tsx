import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminOverview from './AdminOverview';

interface Row { [key: string]: unknown }

function chainable(rows: Row[]) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.then = (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null });
  return query;
}

const roles = [
  { user_id: 'u-pure', role: 'client' },
  { user_id: 'u-dual-therapist', role: 'client' },
  { user_id: 'u-dual-therapist', role: 'therapist' },
  { user_id: 'u-dual-admin', role: 'client' },
  { user_id: 'u-dual-admin', role: 'admin' },
];

const therapists = [
  { id: 't1', verified: true },
  { id: 't2', verified: false },
];

const sessions: Row[] = [];
const articles: Row[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'user_roles') return chainable(roles);
      if (table === 'therapists') return chainable(therapists);
      if (table === 'sessions') return chainable(sessions);
      if (table === 'articles') return chainable(articles);
      return chainable([]);
    },
  },
}));

describe('AdminOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts only pure-client accounts toward Total Clients, excluding dual-role users', async () => {
    render(
      <MemoryRouter>
        <AdminOverview />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Total Clients')).toBeInTheDocument());
    const card = screen.getByText('Total Clients').closest('a');
    expect(card?.querySelector('.text-3xl')?.textContent).toBe('1');
  });

  it('shows the verified therapist count', async () => {
    render(
      <MemoryRouter>
        <AdminOverview />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Verified Therapists')).toBeInTheDocument());
    const card = screen.getByText('Verified Therapists').closest('a');
    expect(card?.querySelector('.text-3xl')?.textContent).toBe('1');
  });
});
