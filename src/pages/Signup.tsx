import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield } from 'lucide-react';
import { AUTH_REDIRECT_URL, SITE_NAME } from '@/lib/site';

const Signup = () => {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

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
        emailRedirectTo: AUTH_REDIRECT_URL,
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
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                minLength={6}
                className="font-ui"
              />
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="font-ui text-sm text-muted-foreground leading-snug cursor-pointer">
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">
                  Terms &amp; Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </Link>
                , and I consent to Nawe processing my personal data to create my account and provide the service.
              </Label>
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
            <Link to="/login" className="text-primary hover:underline font-medium">
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
