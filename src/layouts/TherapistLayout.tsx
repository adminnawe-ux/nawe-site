import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Calendar, Users, DollarSign, UserCircle, LogOut } from 'lucide-react';

const navItems = [
  { to: '/therapist-portal', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/therapist-portal/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/therapist-portal/clients', icon: Users, label: 'Clients' },
  { to: '/therapist-portal/earnings', icon: DollarSign, label: 'Earnings' },
  { to: '/therapist-portal/profile-edit', icon: UserCircle, label: 'Profile' },
];

const TherapistLayout = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6">
          <Link to="/" className="flex items-center"><img src="/logo.png" alt="Nawe Wellness" className="h-9" /></Link>
          <p className="font-ui text-xs text-muted-foreground mt-1">Therapist Portal</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
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
      </aside>
      {/* Main content */}
      <main className="flex-1 bg-background overflow-y-auto">
        <div className="container mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default TherapistLayout;
