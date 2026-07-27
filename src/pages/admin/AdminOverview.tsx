import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Users, UserCheck, CalendarCheck, DollarSign, TrendingUp, FileText } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

const AdminOverview = () => {
  const [stats, setStats] = useState({
    activeClients: 0, activeTherapists: 0, sessionsToday: 0,
    monthlyRevenue: 0, totalSessions: 0, publishedArticles: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();

      // Roles
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const nonClientRoleIds = new Set(
        (roles || []).filter(r => r.role === 'therapist' || r.role === 'admin').map(r => r.user_id)
      );
      const clientCount = new Set(
        (roles || []).filter(r => r.role === 'client' && !nonClientRoleIds.has(r.user_id)).map(r => r.user_id)
      ).size;

      // Therapists
      const { data: therapists } = await supabase.from('therapists').select('id, verified');
      const verifiedCount = (therapists || []).filter(t => t.verified).length;

      // Sessions
      const { data: sessions } = await supabase.from('sessions').select('id, scheduled_at, status, price');
      const allSessions = sessions || [];
      const todaySessions = allSessions.filter(s => {
        const d = new Date(s.scheduled_at);
        return d >= startOfDay(now) && d <= endOfDay(now) && s.status !== 'cancelled';
      });
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const monthlyRevenue = allSessions
        .filter(s => {
          const d = new Date(s.scheduled_at);
          return d >= monthStart && d <= monthEnd && s.status === 'completed';
        })
        .reduce((sum, s) => sum + (s.price || 0), 0);

      // Articles
      const { data: articles } = await supabase.from('articles').select('id, status');
      const publishedCount = (articles || []).filter(a => a.status === 'published').length;

      setStats({
        activeClients: clientCount,
        activeTherapists: verifiedCount,
        sessionsToday: todaySessions.length,
        monthlyRevenue,
        totalSessions: allSessions.length,
        publishedArticles: publishedCount,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const cards = [
    { label: 'Total Clients', value: String(stats.activeClients), icon: Users, link: '/admin/clients' },
    { label: 'Verified Therapists', value: String(stats.activeTherapists), icon: UserCheck, link: '/admin/therapists' },
    { label: 'Sessions Today', value: String(stats.sessionsToday), icon: CalendarCheck, link: '/admin/sessions' },
    { label: 'Revenue (Month)', value: `KES ${stats.monthlyRevenue.toLocaleString()}`, icon: DollarSign, link: '/admin/finance' },
    { label: 'Total Sessions', value: String(stats.totalSessions), icon: TrendingUp, link: '/admin/analytics' },
    { label: 'Published Articles', value: String(stats.publishedArticles), icon: FileText, link: '/admin/content' },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground mb-2">Platform Overview</h1>
      <p className="font-body text-muted-foreground mb-8">Real-time platform health and KPIs.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map(c => (
          <Link key={c.label} to={c.link} className="bg-card rounded-card p-6 shadow-card border border-border hover:shadow-soft transition-shadow group">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <c.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="font-ui text-sm text-muted-foreground">{c.label}</p>
            </div>
            <p className="font-display text-3xl text-foreground">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
