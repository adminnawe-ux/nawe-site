import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import * as AuthContext from '@/contexts/AuthContext';
import type { User } from '@supabase/supabase-js';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUser = { id: 'user-1', email: 'test@example.com' } as User;

function renderWithRouter(requiredRole?: 'client' | 'therapist' | 'admin') {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute requiredRole={requiredRole}>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while auth is loading', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null, roles: [], loading: true, session: null, signOut: vi.fn(),
    });
    renderWithRouter('client');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null, roles: [], loading: false, session: null, signOut: vi.fn(),
    });
    renderWithRouter('client');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows spinner when user is authenticated but roles not yet loaded', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: mockUser, roles: [], loading: false, session: null, signOut: vi.fn(),
    });
    renderWithRouter('client');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to / when user lacks required role', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: mockUser, roles: ['client'], loading: false, session: null, signOut: vi.fn(),
    });
    renderWithRouter('therapist');
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user has the required role', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: mockUser, roles: ['client'], loading: false, session: null, signOut: vi.fn(),
    });
    renderWithRouter('client');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children without role requirement when authenticated', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: mockUser, roles: [], loading: false, session: null, signOut: vi.fn(),
    });
    renderWithRouter();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('allows admin access to admin-only route', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: mockUser, roles: ['admin'], loading: false, session: null, signOut: vi.fn(),
    });
    renderWithRouter('admin');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
