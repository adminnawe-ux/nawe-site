import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
const EVENTS = [
  { id: 'evt-1', title: 'The State of Corporate Health in Kenya', starts_at: '2026-10-29T17:00:00+00:00' },
  { id: 'evt-2', title: 'Open Day', starts_at: '2026-09-01T09:00:00+00:00' },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }) },
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: (table: string) => ({
      select: () => ({
        order: () => ({ limit: () => Promise.resolve({ data: table === 'events' ? EVENTS : [] }) }),
      }),
    }),
  },
}));

import AdminBroadcast from './AdminBroadcast';

describe('AdminBroadcast — event attendees audience', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  async function renderReady() {
    render(<AdminBroadcast />);
    await waitFor(() => expect(screen.getByText('No broadcasts sent yet.')).toBeInTheDocument());
  }

  it('offers an Event attendees audience with an event picker', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Event attendees'));
    const picker = await screen.findByLabelText(/event/i, { selector: 'select' });
    expect(picker).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /The State of Corporate Health in Kenya/ })).toBeInTheDocument();
  });

  it('needs an event picked before the audience counts as selected', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Event attendees'));
    expect(screen.getByRole('button', { name: /preview recipient count/i })).toBeDisabled();
    fireEvent.change(await screen.findByLabelText(/event/i, { selector: 'select' }), { target: { value: 'evt-1' } });
    expect(screen.getByRole('button', { name: /preview recipient count/i })).toBeEnabled();
  });

  it('sends event_id to send-broadcast', async () => {
    invokeMock.mockResolvedValueOnce({ data: { recipient_count: 26 }, error: null });
    await renderReady();
    fireEvent.click(screen.getByText('Event attendees'));
    fireEvent.change(await screen.findByLabelText(/event/i, { selector: 'select' }), { target: { value: 'evt-1' } });
    fireEvent.click(screen.getByRole('button', { name: /preview recipient count/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('send-broadcast', expect.objectContaining({
      body: expect.objectContaining({ event_id: 'evt-1', roles: [], include_newsletter: false, preview: true }),
    })));
    expect(await screen.findByText('26')).toBeInTheDocument();
  });

  it('does not send event_id when the option is unticked', async () => {
    invokeMock.mockResolvedValue({ data: { recipient_count: 3 }, error: null });
    await renderReady();
    fireEvent.click(screen.getByText('Event attendees'));
    fireEvent.change(await screen.findByLabelText(/event/i, { selector: 'select' }), { target: { value: 'evt-1' } });
    fireEvent.click(screen.getByText('Event attendees')); // untick
    fireEvent.click(screen.getByText('Clients'));
    fireEvent.click(screen.getByRole('button', { name: /preview recipient count/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(invokeMock.mock.calls[0][1].body.event_id).toBeUndefined();
  });
});
