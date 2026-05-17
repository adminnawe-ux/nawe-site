import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, Calendar, Users, DollarSign, UserCircle, LogOut, Menu, Clock, XCircle } from 'lucide-react';
import { SITE_NAME, SUPPORT_EMAIL } from '@/lib/site';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/therapist-portal', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/therapist-portal/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/therapist-portal/clients', icon: Users, label: 'Clients' },
  { to: '/therapist-portal/earnings', icon: DollarSign, label: 'Earnings' },
  { to: '/therapist-portal/profile-edit', icon: UserCircle, label: 'Profile' },
];

const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-ui text-sm transition-colors ${
              location.pathname === to
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-ui text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );
};

const TherapistLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('therapists')
      .select('verification_status, verified')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setVerificationStatus(data?.verification_status ?? null);
        setChecking(false);
      });
  }, [user]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (verificationStatus === 'pending') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-warning/15 flex items-center justify-center">
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </div>
          <h1 className="font-display text-2xl text-foreground">Application under review</h1>
          <p className="font-body text-muted-foreground">
            Thank you for completing your profile. Our team is reviewing your application and will notify you by email once approved — usually within 1–2 business days.
          </p>
          <p className="font-ui text-sm text-muted-foreground">
            Questions? Email us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">{SUPPORT_EMAIL}</a>
          </p>
          <button onClick={signOut} className="font-ui text-sm text-muted-foreground hover:text-foreground underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/15 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="font-display text-2xl text-foreground">Application not approved</h1>
          <p className="font-body text-muted-foreground">
            Unfortunately your application was not approved at this time. Please contact us if you believe this is an error or would like to discuss next steps.
          </p>
          <p className="font-ui text-sm text-muted-foreground">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">{SUPPORT_EMAIL}</a>
          </p>
          <button onClick={signOut} className="font-ui text-sm text-muted-foreground hover:text-foreground underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col">
        <div className="p-6">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt={SITE_NAME} className="h-9" />
          </Link>
          <p className="font-ui text-xs text-muted-foreground mt-1">Therapist Portal</p>
        </div>
        <NavItems />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center px-4 gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <div className="p-6">
              <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center">
                <img src="/logo.png" alt={SITE_NAME} className="h-9" />
              </Link>
              <p className="font-ui text-xs text-muted-foreground mt-1">Therapist Portal</p>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Link to="/" className="flex items-center">
          <img src="/logo.png" alt={SITE_NAME} className="h-8" />
        </Link>
      </div>

      {/* Main content */}
      <main className="flex-1 bg-background overflow-y-auto">
        <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 mt-14 md:mt-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default TherapistLayout;
