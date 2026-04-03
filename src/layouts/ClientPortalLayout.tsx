import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Home, Search, Settings } from 'lucide-react';

const ClientPortalLayout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center">
            <img src="/logo.png" alt="Nawe Wellness" className="h-10" />
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="font-ui text-sm gap-2">
                <Home className="h-4 w-4" /> Dashboard
              </Button>
            </Link>
            <Link to="/matches">
              <Button variant="ghost" size="sm" className="font-ui text-sm gap-2">
                <Search className="h-4 w-4" /> Find Therapist
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="sm" className="font-ui text-sm gap-2">
                <Settings className="h-4 w-4" /> Settings
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="font-ui text-sm gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
          <div className="md:hidden flex items-center gap-1">
            <Link to="/settings">
              <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>
      <main className="flex-1 bg-background">
        <Outlet />
      </main>
    </div>
  );
};

export default ClientPortalLayout;
