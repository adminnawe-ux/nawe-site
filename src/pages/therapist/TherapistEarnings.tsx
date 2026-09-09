import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

interface EarningsRow extends Session {
  client_name: string;
}

const TherapistEarnings = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<EarningsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: therapist } = await supabase
        .from('therapists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!therapist) { setLoading(false); return; }

      // RLS already restricts this to payment_status='paid' sessions only.
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('therapist_id', therapist.id)
        .order('scheduled_at', { ascending: false });

      const list = sessions ?? [];
      const clientIds = [...new Set(list.map((s) => s.client_id))];
      const nameByClientId = new Map<string, string>();
      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', clientIds);
        for (const p of profiles ?? []) {
          nameByClientId.set(p.user_id, [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Client');
        }
      }

      setRows(list.map((s) => ({ ...s, client_name: nameByClientId.get(s.client_id) ?? 'Client' })));
      setLoading(false);
    };
    load();
  }, [user]);

  const currency = rows[0]?.currency ?? 'KES';
  const totalEarned = rows.reduce((sum, r) => sum + (r.therapist_payout ?? 0), 0);
  const monthStart = startOfMonth(new Date());
  const monthEarned = rows
    .filter((r) => new Date(r.scheduled_at) >= monthStart)
    .reduce((sum, r) => sum + (r.therapist_payout ?? 0), 0);

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground mb-2">Earnings</h1>
      <p className="font-body text-muted-foreground mb-10">Track your income and payouts.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-card p-6 shadow-card border border-border flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-ui text-sm text-muted-foreground">Total earned</p>
            {loading ? <Skeleton className="h-7 w-24 mt-1" /> : (
              <p className="font-display text-2xl text-foreground">{currency} {totalEarned.toLocaleString()}</p>
            )}
          </div>
        </div>
        <div className="bg-card rounded-card p-6 shadow-card border border-border flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-ui text-sm text-muted-foreground">This month</p>
            {loading ? <Skeleton className="h-7 w-24 mt-1" /> : (
              <p className="font-display text-2xl text-foreground">{currency} {monthEarned.toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-card shadow-card border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-display text-lg text-foreground">Payout history</h2>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-body text-muted-foreground">Earnings will be displayed here once you begin accepting sessions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-ui text-xs text-muted-foreground">Date</th>
                  <th className="text-left p-4 font-ui text-xs text-muted-foreground">Client</th>
                  <th className="text-left p-4 font-ui text-xs text-muted-foreground">Format</th>
                  <th className="text-right p-4 font-ui text-xs text-muted-foreground">Session fee</th>
                  <th className="text-right p-4 font-ui text-xs text-muted-foreground">Your payout</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="p-4 font-body text-muted-foreground">{format(new Date(r.scheduled_at), 'd MMM yyyy')}</td>
                    <td className="p-4 font-body text-foreground">{r.client_name}</td>
                    <td className="p-4 font-ui text-xs text-muted-foreground">{r.session_format ?? '—'}</td>
                    <td className="p-4 text-right font-body text-muted-foreground">{r.currency ?? currency} {(r.price ?? 0).toLocaleString()}</td>
                    <td className="p-4 text-right font-ui font-medium text-success">{r.currency ?? currency} {(r.therapist_payout ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TherapistEarnings;
