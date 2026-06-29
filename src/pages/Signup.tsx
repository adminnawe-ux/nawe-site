import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { AUTH_REDIRECT_URL, SITE_NAME } from '@/lib/site';

const Signup = () => {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get('redirect_to');

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError('');
    const redirectUrl = redirectTo && redirectTo.startsWith('/')
      ? `${AUTH_REDIRECT_URL}?redirect_to=${encodeURIComponent(redirectTo)}`
      : AUTH_REDIRECT_URL;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });
    if (error) {
      setError('Could not sign up with Google. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!termsAccepted) {
      setError('You must agree to the Terms & Conditions.');
      setLoading(false);
      return;
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName },
        emailRedirectTo:
          redirectTo && redirectTo.startsWith('/')
            ? `${AUTH_REDIRECT_URL}?redirect_to=${encodeURIComponent(redirectTo)}`
            : AUTH_REDIRECT_URL,
      },
    });

    if (error) {
      setError("Something went wrong. Let's try that again.");
    } else {
      // Record terms acceptance
      if (signUpData.user) {
        await supabase.from('profiles').update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: '1.0',
        }).eq('user_id', signUpData.user.id);
      }
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <h2 className="font-display text-2xl text-foreground mb-3">Check your email</h2>
          <p className="font-body text-muted-foreground">
            We've sent you a confirmation link. Once confirmed, you can start finding your therapist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/"><img src="/logo.png" alt={SITE_NAME} className="h-14 mx-auto" /></Link>
          <p className="font-body text-muted-foreground mt-2">Your first step to feeling better starts here.</p>
        </div>
        <div className="bg-card rounded-card p-8 shadow-soft border border-border">
          <div className="space-y-3 mb-5">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms-google"
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms-google" className="font-ui text-sm text-muted-foreground leading-snug cursor-pointer">
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">Terms &amp; Conditions</Link>
                {' '}and{' '}
                <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">Privacy Policy</Link>
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full font-ui gap-3"
              onClick={handleGoogleSignUp}
              disabled={googleLoading || !termsAccepted}
            >
              {googleLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </Button>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 font-ui text-xs text-muted-foreground">or sign up with email</span></div>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="font-ui">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="What should we call you?"
                required
                className="font-ui"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="font-ui">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="font-ui"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-ui">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  minLength={6}
                  className="font-ui pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p className="font-ui text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full font-ui" disabled={loading || !termsAccepted}>
              {loading ? 'Creating your account...' : 'Create Account'}
            </Button>
          </form>
          <p className="mt-6 text-center font-ui text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to={redirectTo ? `/login?redirect_to=${encodeURIComponent(redirectTo)}` : '/login'}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 mt-6 text-muted-foreground">
          <Shield className="h-4 w-4" />
          <p className="font-ui text-xs">We use your information to create your account and provide the Platform. See our Privacy Policy for details.</p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
