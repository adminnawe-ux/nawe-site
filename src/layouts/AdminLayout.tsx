import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, UserCheck, CalendarCheck, DollarSign,
  FileText, BarChart3, Settings, LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/therapists', icon: UserCheck, label: 'Therapists' },
  { to: '/admin/clients', icon: Users, label: 'Clients' },
  { to: '/admin/sessions', icon: CalendarCheck, label: 'Sessions' },
  { to: '/admin/finance', icon: DollarSign, label: 'Finance' },
  { to: '/admin/content', icon: FileText, label: 'Content' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

const AdminLayout = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-foreground text-primary-foreground flex flex-col">
        <div className="p-6">
          <Link to="/" className="font-display text-xl text-primary-foreground">Nawe Admin</Link>
          <p className="font-ui text-xs text-primary-foreground/60 mt-1">Platform Management</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-ui text-sm transition-colors ${
                location.pathname === to
                  ? 'bg-primary/20 text-primary-foreground font-medium'
                  : 'text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-primary-foreground/10">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-ui text-sm text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-background overflow-y-auto">
        <div className="container mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
