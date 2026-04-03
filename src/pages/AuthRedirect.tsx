import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AuthRedirect = () => {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (roles.length === 0) return; // still loading roles

    if (roles.includes('admin')) {
      navigate('/admin', { replace: true });
    } else if (roles.includes('therapist')) {
      navigate('/therapist-portal', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [user, roles, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="font-ui text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
};

export default AuthRedirect;
