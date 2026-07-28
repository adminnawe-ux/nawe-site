import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

const Unsubscribe = () => {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This unsubscribe link is missing a token.');
      return;
    }

    supabase.functions.invoke('unsubscribe-broadcast', { body: { token } }).then(({ data, error }) => {
      if (error || !data?.unsubscribed) {
        setStatus('error');
        setMessage(data?.error ?? 'This unsubscribe link is invalid or has expired.');
        return;
      }
      setStatus('success');
    });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {status === 'loading' && (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <h1 className="font-display text-2xl text-foreground">You've been unsubscribed</h1>
            <p className="font-body text-muted-foreground">You won't receive any more broadcast emails from Nawe.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="font-display text-2xl text-foreground">Something went wrong</h1>
            <p className="font-body text-muted-foreground">{message}</p>
          </>
        )}
        <Link to="/" className="font-ui text-sm text-primary hover:underline inline-block pt-2">
          Return to Nawe
        </Link>
      </div>
    </div>
  );
};

export default Unsubscribe;
