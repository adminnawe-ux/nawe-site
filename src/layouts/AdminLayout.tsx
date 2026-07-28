import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, UserCheck, CalendarCheck, DollarSign,
  FileText, BarChart3, Settings, LogOut, Menu, CalendarDays, Star, Megaphone,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/therapists', icon: UserCheck, label: 'Therapists' },
  { to: '/admin/clients', icon: Users, label: 'Clients' },
  { to: '/admin/sessions', icon: CalendarCheck, label: 'Sessions' },
  { to: '/admin/events', icon: CalendarDays, label: 'Events' },
  { to: '/admin/finance', icon: DollarSign, label: 'Finance' },
  { to: '/admin/content', icon: FileText, label: 'Content' },
  { to: '/admin/reviews', icon: Star, label: 'Reviews' },
  { to: '/admin/broadcast', icon: Megaphone, label: 'Broadcast' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
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
    </>
  );
};

const AdminLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-foreground text-primary-foreground flex-col">
        <div className="p-6">
          <Link to="/"><img src="/nawe-logo.png" alt="Nawe" className="h-10 w-auto" /></Link>
          <p className="font-ui text-xs text-primary-foreground/60 mt-1">Platform Management</p>
        </div>
        <NavItems />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-foreground flex items-center px-4 gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 text-primary-foreground hover:bg-primary-foreground/10">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col bg-foreground text-primary-foreground border-primary-foreground/10">
            <div className="p-6">
              <Link to="/" onClick={() => setMobileOpen(false)}>
                <img src="/nawe-logo.png" alt="Nawe" className="h-10 w-auto" />
              </Link>
              <p className="font-ui text-xs text-primary-foreground/60 mt-1">Platform Management</p>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <img src="/nawe-logo.png" alt="Nawe" className="h-8 w-auto" />
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

export default AdminLayout;
