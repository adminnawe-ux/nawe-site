import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const THERAPIST_ONBOARDING_FLAG = 'nawe_pending_therapist_onboarding';
const QUESTIONNAIRE_PENDING_FLAG = 'nawe_pending_questionnaire';

const AuthRedirect = () => {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get('redirect_to');

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (roles.length === 0) return; // still loading roles

    if (redirectTo && redirectTo.startsWith('/')) {
      navigate(redirectTo, { replace: true });
      return;
    }

    const isInvitedTherapist =
      user.user_metadata?.account_type === 'therapist' ||
      user.app_metadata?.account_type === 'therapist';
    const pendingTherapistApplication = localStorage.getItem(THERAPIST_ONBOARDING_FLAG) === '1';
    if ((isInvitedTherapist || pendingTherapistApplication) && !roles.includes('therapist')) {
      navigate('/therapist-portal/onboarding', { replace: true });
      return;
    }

    const pendingQuestionnaire = localStorage.getItem(QUESTIONNAIRE_PENDING_FLAG) === '1';
    if (pendingQuestionnaire) {
      navigate('/questionnaire', { replace: true });
      return;
    }

    if (roles.includes('admin')) {
      navigate('/admin', { replace: true });
    } else if (roles.includes('therapist')) {
      navigate('/therapist-portal', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [user, roles, loading, navigate, redirectTo]);

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
