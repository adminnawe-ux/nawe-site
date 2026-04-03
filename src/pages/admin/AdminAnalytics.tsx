import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, Calendar, TrendingUp, DollarSign, Star, XCircle } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

const COLORS = ['hsl(144,15%,55%)', 'hsl(212,29%,50%)', 'hsl(18,48%,56%)', 'hsl(170,37%,46%)', 'hsl(42,58%,55%)'];

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClients: 0, totalTherapists: 0, verifiedTherapists: 0,
    totalSessions: 0, completedSessions: 0, cancelledSessions: 0,
    totalRevenue: 0, avgRating: 0,
  });
  const [sessionsByDay, setSessionsByDay] = useState<{ day: string; count: number }[]>([]);
  const [sessionsByStatus, setSessionsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; revenue: number }[]>([]);
  const [topTherapists, setTopTherapists] = useState<{ name: string; sessions: number; revenue: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      // Roles
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const clientCount = new Set((roles || []).filter(r => r.role === 'client').map(r => r.user_id)).size;

      // Therapists
      const { data: therapists } = await supabase.from('therapists').select('id, user_id, verified');
      const therapistCount = (therapists || []).length;
      const verifiedCount = (therapists || []).filter(t => t.verified).length;

      // Sessions
      const { data: sessions } = await supabase.from('sessions').select('id, scheduled_at, status, price, currency, therapist_id');
      const allSessions = sessions || [];
      const completed = allSessions.filter(s => s.status === 'completed');
      const cancelled = allSessions.filter(s => s.status === 'cancelled');
      const totalRevenue = completed.reduce((sum, s) => sum + (s.price || 0), 0);

      // Reviews
      const { data: reviews } = await supabase.from('reviews').select('rating');
      const avgRating = reviews && reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : 0;

      setStats({
        totalClients: clientCount,
        totalTherapists: therapistCount,
        verifiedTherapists: verifiedCount,
        totalSessions: allSessions.length,
        completedSessions: completed.length,
        cancelledSessions: cancelled.length,
        totalRevenue,
        avgRating,
      });

      // Sessions by day (last 14 days)
      const dayData: { day: string; count: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const dayStr = format(d, 'MMM d');
        const count = allSessions.filter(s => {
          const sd = new Date(s.scheduled_at);
          return sd >= startOfDay(d) && sd <= endOfDay(d);
        }).length;
        dayData.push({ day: dayStr, count });
      }
      setSessionsByDay(dayData);

      // Sessions by status
      const statusCounts = allSessions.reduce((acc, s) => {
        const st = s.status || 'pending';
        acc[st] = (acc[st] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      setSessionsByStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

      // Revenue by month (last 6 months)
      const monthData: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(new Date(), i);
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        const rev = completed
          .filter(s => {
            const sd = new Date(s.scheduled_at);
            return sd >= mStart && sd <= mEnd;
          })
          .reduce((sum, s) => sum + (s.price || 0), 0);
        monthData.push({ month: format(m, 'MMM'), revenue: rev });
      }
      setRevenueByMonth(monthData);

      // Top therapists
      const therapistSessions: Record<string, { sessions: number; revenue: number; userId: string }> = {};
      for (const s of allSessions) {
        if (!therapistSessions[s.therapist_id]) {
          const t = (therapists || []).find(t => t.id === s.therapist_id);
          therapistSessions[s.therapist_id] = { sessions: 0, revenue: 0, userId: t?.user_id || '' };
        }
        therapistSessions[s.therapist_id].sessions += 1;
        if (s.status === 'completed') therapistSessions[s.therapist_id].revenue += s.price || 0;
      }

      const topEntries = Object.entries(therapistSessions)
        .sort(([, a], [, b]) => b.sessions - a.sessions)
        .slice(0, 5);

      const topList = [];
      for (const [, v] of topEntries) {
        let name = 'Unknown';
        if (v.userId) {
          const { data: p } = await supabase.from('therapist_public_profiles').select('first_name, last_name').eq('user_id', v.userId).maybeSingle();
          if (p) name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
        }
        topList.push({ name, sessions: v.sessions, revenue: v.revenue });
      }
      setTopTherapists(topList);

      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground mb-2">Analytics & Reporting</h1>
      <p className="font-body text-muted-foreground mb-8">Platform-wide metrics, growth trends, and performance insights.</p>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Clients', value: stats.totalClients, icon: Users },
          { label: 'Therapists', value: `${stats.verifiedTherapists}/${stats.totalTherapists}`, icon: UserCheck, sub: 'verified' },
          { label: 'Total Sessions', value: stats.totalSessions, icon: Calendar },
          { label: 'Total Revenue', value: `KES ${stats.totalRevenue.toLocaleString()}`, icon: DollarSign },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-card p-5 border border-border shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="h-4 w-4 text-muted-foreground" />
              <p className="font-ui text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </div>
            <p className="font-display text-2xl text-foreground">{s.value}</p>
            {'sub' in s && <p className="font-ui text-xs text-muted-foreground">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-card p-4 border border-border shadow-card flex items-center gap-3">
          <Star className="h-5 w-5 text-warning" />
          <div>
            <p className="font-display text-xl text-foreground">{stats.avgRating || '—'}</p>
            <p className="font-ui text-xs text-muted-foreground">Avg Rating</p>
          </div>
        </div>
        <div className="bg-card rounded-card p-4 border border-border shadow-card flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-success" />
          <div>
            <p className="font-display text-xl text-foreground">{stats.completedSessions}</p>
            <p className="font-ui text-xs text-muted-foreground">Completed</p>
          </div>
        </div>
        <div className="bg-card rounded-card p-4 border border-border shadow-card flex items-center gap-3">
          <XCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-display text-xl text-foreground">{stats.cancelledSessions}</p>
            <p className="font-ui text-xs text-muted-foreground">Cancelled</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sessions Last 14 Days */}
        <div className="bg-card rounded-card p-5 border border-border shadow-card">
          <h3 className="font-display text-base text-foreground mb-4">Sessions — Last 14 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sessionsByDay}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="hsl(144,15%,55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Trend */}
        <div className="bg-card rounded-card p-5 border border-border shadow-card">
          <h3 className="font-display text-base text-foreground mb-4">Revenue Trend — 6 Months</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(30,15%,85%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => `KES ${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(212,29%,50%)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-card rounded-card p-5 border border-border shadow-card">
          <h3 className="font-display text-base text-foreground mb-4">Session Status Distribution</h3>
          {sessionsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sessionsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {sessionsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-body text-sm text-muted-foreground text-center py-12">No session data yet</p>
          )}
        </div>

        {/* Top Therapists */}
        <div className="bg-card rounded-card p-5 border border-border shadow-card">
          <h3 className="font-display text-base text-foreground mb-4">Top Therapists</h3>
          {topTherapists.length > 0 ? (
            <div className="space-y-3">
              {topTherapists.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="font-ui text-xs text-primary font-semibold">{i + 1}</span>
                    </div>
                    <div>
                      <p className="font-display text-sm text-foreground">{t.name}</p>
                      <p className="font-ui text-xs text-muted-foreground">{t.sessions} sessions</p>
                    </div>
                  </div>
                  <p className="font-ui text-sm text-foreground">KES {t.revenue.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground text-center py-12">No data yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
