import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Login from './Login';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}));

vi.mock('@/lib/site', () => ({
  SITE_NAME: 'Nawe',
  AUTH_REDIRECT_URL: 'http://localhost/auth-redirect',
}));

import { supabase } from '@/integrations/supabase/client';

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderLogin() {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    );
  }

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error message on failed login', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials', name: 'AuthError', status: 400 } as never,
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/that didn't work/i)).toBeInTheDocument();
    });
  });

  it('navigates to /auth-redirect on successful login', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'user-1' } as never, session: {} as never },
      error: null,
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth-redirect');
    });
  });

  it('renders Google sign-in button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('calls signInWithOAuth with google provider on Google button click', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({ data: { provider: 'google', url: '' }, error: null });

    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' })
      );
    });
  });

  it('toggles password visibility', () => {
    renderLogin();
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
