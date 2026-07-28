import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Unsubscribe from './Unsubscribe';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/unsubscribe${search}`]}>
      <Unsubscribe />
    </MemoryRouter>
  );

describe('Unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when the token is missing', async () => {
    renderAt('');
    await waitFor(() => expect(screen.getByText(/missing a token/i)).toBeInTheDocument());
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('calls unsubscribe-broadcast with the token and shows success', async () => {
    invokeMock.mockResolvedValueOnce({ data: { unsubscribed: true }, error: null });
    renderAt('?token=abc123');

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('unsubscribe-broadcast', { body: { token: 'abc123' } });
    });
    await waitFor(() => expect(screen.getByText(/you've been unsubscribed/i)).toBeInTheDocument());
  });

  it('shows an error message when the function call fails', async () => {
    invokeMock.mockResolvedValueOnce({ data: { error: 'Invalid token' }, error: null });
    renderAt('?token=bad');

    await waitFor(() => expect(screen.getByText('Invalid token')).toBeInTheDocument());
  });
});
