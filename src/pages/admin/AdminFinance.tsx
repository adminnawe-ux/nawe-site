import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DollarSign, TrendingUp, Calendar, CreditCard } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface SessionFinance {
  id: string;
  scheduled_at: string;
  status: string | null;
  price: number | null;
  currency: string | null;
  therapist_name: string;
  client_name: string;
}

const AdminFinance = () => {
  const [sessions, setSessions] = useState<SessionFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState('0');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const targetMonth = subMonths(new Date(), parseInt(monthOffset));
      const start = startOfMonth(targetMonth);
      const end = endOfMonth(targetMonth);

      const { data: sessionData } = await supabase
        .from('sessions')
        .select(`id, scheduled_at, status, price, currency, therapist_id, client_id,
          therapist:therapists!sessions_therapist_id_fkey ( user_id )`)
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
        .order('scheduled_at', { ascending: false });

      const enriched: SessionFinance[] = [];
      for (const s of sessionData || []) {
        const therapist = Array.isArray(s.therapist) ? s.therapist[0] : s.therapist;
        let therapist_name = 'Unknown';
        let client_name = 'Unknown';
        if (therapist?.user_id) {
          const { data: tp } = await supabase.from('profiles').select('first_name, last_name').eq('user_id', therapist.user_id).maybeSingle();
          if (tp) therapist_name = `${tp.first_name || ''} ${tp.last_name || ''}`.trim();
        }
        const { data: cp } = await supabase.from('profiles').select('first_name, last_name').eq('user_id', s.client_id).maybeSingle();
        if (cp) client_name = `${cp.first_name || ''} ${cp.last_name || ''}`.trim();

        enriched.push({
          id: s.id,
          scheduled_at: s.scheduled_at,
          status: s.status,
          price: s.price,
          currency: s.currency,
          therapist_name,
          client_name,
        });
      }
      setSessions(enriched);
      setLoading(false);
    };
    fetch();
  }, [monthOffset]);

  const completed = sessions.filter(s => s.status === 'completed');
  const totalRevenue = completed.reduce((sum, s) => sum + (s.price || 0), 0);
  const allWithPrice = sessions.filter(s => s.price && s.status !== 'cancelled');
  const projectedRevenue = allWithPrice.reduce((sum, s) => sum + (s.price || 0), 0);
  const avgSessionValue = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0;
  const targetMonth = subMonths(new Date(), parseInt(monthOffset));

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground mb-2">Finance & Revenue</h1>
          <p className="font-body text-muted-foreground">Platform revenue, session payments, and financial insights.</p>
        </div>
        <Select value={monthOffset} onValueChange={setMonthOffset}>
          <SelectTrigger className="w-44 font-ui"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">This Month</SelectItem>
            <SelectItem value="1">Last Month</SelectItem>
            <SelectItem value="2">2 Months Ago</SelectItem>
            <SelectItem value="3">3 Months Ago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: `KES ${totalRevenue.toLocaleString()}`, icon: DollarSign, sub: 'Completed sessions' },
          { label: 'Projected', value: `KES ${projectedRevenue.toLocaleString()}`, icon: TrendingUp, sub: 'All non-cancelled' },
          { label: 'Avg Session Value', value: `KES ${avgSessionValue.toLocaleString()}`, icon: CreditCard, sub: 'Per completed session' },
          { label: 'Sessions', value: String(sessions.length), icon: Calendar, sub: format(targetMonth, 'MMMM yyyy') },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-card p-5 border border-border shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="h-4 w-4 text-muted-foreground" />
              <p className="font-ui text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </div>
            <p className="font-display text-2xl text-foreground">{s.value}</p>
            <p className="font-body text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Transaction Table */}
      <div className="bg-card rounded-card border border-border shadow-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-display text-lg text-foreground">Transactions — {format(targetMonth, 'MMMM yyyy')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Date</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Client</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Therapist</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Status</th>
                <th className="text-right font-ui text-xs text-muted-foreground p-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-ui text-sm text-foreground">{format(new Date(s.scheduled_at), 'MMM d, h:mm a')}</td>
                  <td className="p-4 font-body text-sm text-muted-foreground">{s.client_name}</td>
                  <td className="p-4 font-body text-sm text-muted-foreground">{s.therapist_name}</td>
                  <td className="p-4">
                    <Badge variant={s.status === 'completed' ? 'default' : 'outline'} className="font-ui text-xs">
                      {s.status || 'pending'}
                    </Badge>
                  </td>
                  <td className="p-4 text-right font-ui text-sm text-foreground">
                    {s.price ? `${s.currency || 'KES'} ${s.price.toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center font-body text-muted-foreground">No transactions for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminFinance;
