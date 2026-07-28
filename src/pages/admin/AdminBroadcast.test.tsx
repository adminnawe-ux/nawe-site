import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminBroadcast from './AdminBroadcast';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
    },
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [] }),
        }),
      }),
    }),
  },
}));

describe('AdminBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the compose form and audience checkboxes', async () => {
    render(<AdminBroadcast />);
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Therapists')).toBeInTheDocument();
    expect(screen.getByText('Admins')).toBeInTheDocument();
    expect(screen.getByText('Newsletter subscribers')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('No broadcasts sent yet.')).toBeInTheDocument());
  });

  it('disables Preview and Send until an audience is selected', async () => {
    render(<AdminBroadcast />);
    await waitFor(() => expect(screen.getByText('No broadcasts sent yet.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /preview recipient count/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /send broadcast/i })).toBeDisabled();
  });

  it('calls send-broadcast with preview:true and shows the recipient count', async () => {
    invokeMock.mockResolvedValueOnce({ data: { recipient_count: 42 }, error: null });
    render(<AdminBroadcast />);
    await waitFor(() => expect(screen.getByText('No broadcasts sent yet.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Clients'));
    fireEvent.click(screen.getByRole('button', { name: /preview recipient count/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('send-broadcast', expect.objectContaining({
        body: expect.objectContaining({ roles: ['client'], preview: true }),
      }));
    });
    await waitFor(() => expect(screen.getByText(/This will email/)).toBeInTheDocument());
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('includes the CC field in the send-broadcast payload', async () => {
    invokeMock.mockResolvedValueOnce({ data: { recipient_count: 5 }, error: null });
    render(<AdminBroadcast />);
    await waitFor(() => expect(screen.getByText('No broadcasts sent yet.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Clients'));
    fireEvent.change(screen.getByPlaceholderText(/cc@nawe.co.ke/i), { target: { value: 'a@nawe.co.ke, b@nawe.co.ke' } });
    fireEvent.click(screen.getByRole('button', { name: /preview recipient count/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('send-broadcast', expect.objectContaining({
        body: expect.objectContaining({ cc: 'a@nawe.co.ke, b@nawe.co.ke' }),
      }));
    });
  });

  it('resets the preview count when the audience changes', async () => {
    invokeMock.mockResolvedValueOnce({ data: { recipient_count: 10 }, error: null });
    render(<AdminBroadcast />);
    await waitFor(() => expect(screen.getByText('No broadcasts sent yet.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Clients'));
    fireEvent.click(screen.getByRole('button', { name: /preview recipient count/i }));
    await waitFor(() => expect(screen.getByText(/This will email/)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Therapists'));
    expect(screen.queryByText(/This will email/)).not.toBeInTheDocument();
  });
});
