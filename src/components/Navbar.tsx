import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { SITE_NAME } from '@/lib/site';

const Navbar = () => {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center">
          <img src="/nawe-logo.jpeg" alt={SITE_NAME} className="h-10 w-auto" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/for-therapists" className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors">
            For Therapists
          </Link>
          <Link to="/events" className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors">
            Events
          </Link>
          <Link to="/blog" className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors">
            Journal
          </Link>
          {user ? (
            <>
              {roles.includes('therapist') && (
                <Link to="/therapist-portal" className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Therapist Portal
                </Link>
              )}
              {roles.includes('admin') && (
                <Link to="/admin" className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Admin
                </Link>
              )}
              <Link to="/dashboard" className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Button variant="ghost" onClick={handleSignOut} className="font-ui text-sm">
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" className="font-ui text-sm">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button className="font-ui text-sm bg-primary hover:bg-primary/90">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-card border-b border-border px-6 py-4 space-y-3 animate-fade-in">
          <Link to="/for-therapists" className="block font-ui text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
            For Therapists
          </Link>
          <Link to="/events" className="block font-ui text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
            Events
          </Link>
          <Link to="/blog" className="block font-ui text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
            Journal
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className="block font-ui text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
                Dashboard
              </Link>
              <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="font-ui text-sm text-muted-foreground">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="block font-ui text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
              <Link to="/signup" className="block font-ui text-sm text-accent font-semibold" onClick={() => setMobileOpen(false)}>
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
