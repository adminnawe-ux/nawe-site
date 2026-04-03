import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Hmm, that didn't work. Please check your email and password and try again.");
      setLoading(false);
      return;
    }

    // Navigate to redirect page which will route based on role from AuthContext
    navigate('/auth-redirect');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/"><img src="/logo.png" alt="Nawe Wellness" className="h-14 mx-auto" /></Link>
          <p className="font-body text-muted-foreground mt-2">Welcome back. Let's continue your journey.</p>
        </div>
        <div className="bg-card rounded-card p-8 shadow-soft border border-border">
          <form onSubmit={handleLogin} className="space-y-5">
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
                placeholder="Your password"
                required
                className="font-ui"
              />
            </div>
            {error && (
              <p className="font-ui text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full font-ui" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 text-center space-y-3">
            <Link to="/forgot-password" className="font-ui text-sm text-secondary hover:underline">
              Forgot your password?
            </Link>
            <p className="font-ui text-sm text-muted-foreground">
              New here?{' '}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Create an account
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-6 text-muted-foreground">
          <Shield className="h-4 w-4" />
          <p className="font-ui text-xs">Your information is private and protected.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
