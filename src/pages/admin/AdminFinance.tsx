import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { DollarSign, TrendingUp, Calendar, CreditCard, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface SessionFinance {
  id: string;
  scheduled_at: string;
  status: string | null;
  payment_status: string;
  payment_reference: string | null;
  price: number | null;
  currency: string | null;
  therapist_name: string;
  client_name: string;
  therapist_payout: number | null;
  platform_commission: number | null;
}

const AdminFinance = () => {
  const [sessions, setSessions] = useState<SessionFinance[]>([]);
  const [pendingSessions, setPendingSessions] = useState<SessionFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState('0');
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');

  const enrichSessions = useCallback(async (raw: {
    id: string; scheduled_at: string; status: string | null;
    payment_status: string; payment_reference: string | null;
    price: number | null; currency: string | null;
    therapist_payout: number | null; platform_commission: number | null;
    therapist_id: string; client_id: string;
    therapist: { user_id: string } | { user_id: string }[] | null;
  }[]) => {
    const enriched: SessionFinance[] = [];
    for (const s of raw) {
      const therapist = Array.isArray(s.therapist) ? s.therapist[0] : s.therapist;
      let therapist_name = 'Unknown';
      let client_name = 'Unknown';
      if (therapist?.user_id) {
        const { data: tp } = await supabase.from('therapist_public_profiles').select('first_name, last_name').eq('user_id', therapist.user_id).maybeSingle();
        if (tp) therapist_name = `${tp.first_name || ''} ${tp.last_name || ''}`.trim();
      }
      const { data: cp } = await supabase.from('profiles').select('first_name, last_name').eq('user_id', s.client_id).maybeSingle();
      if (cp) client_name = `${cp.first_name || ''} ${cp.last_name || ''}`.trim();
      enriched.push({
        id: s.id, scheduled_at: s.scheduled_at, status: s.status,
        payment_status: s.payment_status, payment_reference: s.payment_reference,
        price: s.price, currency: s.currency,
        therapist_payout: s.therapist_payout, platform_commission: s.platform_commission,
        therapist_name, client_name,
      });
    }
    return enriched;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const targetMonth = subMonths(new Date(), parseInt(monthOffset));
    const start = startOfMonth(targetMonth);
    const end = endOfMonth(targetMonth);

    const selectFields = `id, scheduled_at, status, payment_status, payment_reference, price, currency,
      therapist_payout, platform_commission, therapist_id, client_id,
      therapist:therapists!sessions_therapist_id_fkey ( user_id )`;

    const [{ data: allData }, { data: pendingData }] = await Promise.all([
      supabase.from('sessions').select(selectFields)
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
        .order('scheduled_at', { ascending: false }),
      supabase.from('sessions').select(selectFields)
        .eq('payment_status', 'pending_verification')
        .order('created_at', { ascending: false }),
    ]);

    const [enrichedAll, enrichedPending] = await Promise.all([
      enrichSessions(allData ?? []),
      enrichSessions(pendingData ?? []),
    ]);

    setSessions(enrichedAll);
    setPendingSessions(enrichedPending);
    setLoading(false);
  }, [monthOffset, enrichSessions]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = async (sessionId: string) => {
    setConfirming(sessionId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('confirm-payment', {
        body: { session_id: sessionId },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (error) throw error;
      if (!data.confirmed) throw new Error('Confirmation failed');
      toast({ title: 'Payment confirmed', description: 'Client and therapist have been notified.' });
      fetchData();
    } catch (err) {
      toast({
        title: 'Failed to confirm',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setConfirming(null);
    }
  };

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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/40 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-1.5 rounded-md font-ui text-sm transition-colors ${activeTab === 'pending' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Pending Verification
          {pendingSessions.length > 0 && (
            <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{pendingSessions.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-1.5 rounded-md font-ui text-sm transition-colors ${activeTab === 'all' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          All Transactions
        </button>
      </div>

      {/* Pending Payments */}
      {activeTab === 'pending' && (
        <div className="bg-card rounded-card border border-border shadow-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <h2 className="font-display text-lg text-foreground">Payments Awaiting Verification</h2>
          </div>
          {pendingSessions.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2 opacity-50" />
              <p className="font-body text-muted-foreground">No payments pending verification.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left font-ui text-xs text-muted-foreground p-4">Date</th>
                    <th className="text-left font-ui text-xs text-muted-foreground p-4">Client</th>
                    <th className="text-left font-ui text-xs text-muted-foreground p-4">Therapist</th>
                    <th className="text-left font-ui text-xs text-muted-foreground p-4">M-Pesa Code</th>
                    <th className="text-right font-ui text-xs text-muted-foreground p-4">Amount</th>
                    <th className="text-right font-ui text-xs text-muted-foreground p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSessions.map(s => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-ui text-sm text-foreground">{format(new Date(s.scheduled_at), 'MMM d, h:mm a')}</td>
                      <td className="p-4 font-body text-sm text-muted-foreground">{s.client_name}</td>
                      <td className="p-4 font-body text-sm text-muted-foreground">{s.therapist_name}</td>
                      <td className="p-4 font-mono text-sm font-bold text-foreground tracking-widest">{s.payment_reference || '—'}</td>
                      <td className="p-4 text-right font-ui text-sm font-semibold text-foreground">
                        {s.price ? `${s.currency || 'KES'} ${s.price.toLocaleString()}` : '—'}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          className="font-ui rounded-full"
                          onClick={() => handleConfirm(s.id)}
                          disabled={confirming === s.id}
                        >
                          {confirming === s.id
                            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Confirming…</>
                            : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirm Payment</>
                          }
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Transactions */}
      {activeTab === 'all' && (
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
                  <th className="text-left font-ui text-xs text-muted-foreground p-4">Payment</th>
                  <th className="text-right font-ui text-xs text-muted-foreground p-4">Amount</th>
                  <th className="text-right font-ui text-xs text-muted-foreground p-4">Therapist Payout</th>
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
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={`font-ui text-xs ${
                          s.payment_status === 'paid' ? 'border-success text-success' :
                          s.payment_status === 'pending_verification' ? 'border-amber-500 text-amber-600' :
                          'border-muted-foreground text-muted-foreground'
                        }`}
                      >
                        {s.payment_status === 'pending_verification' ? 'pending' : s.payment_status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-ui text-sm text-foreground">
                      {s.price ? `${s.currency || 'KES'} ${s.price.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-4 text-right font-ui text-sm text-muted-foreground">
                      {s.therapist_payout ? `${s.currency || 'KES'} ${s.therapist_payout.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center font-body text-muted-foreground">No transactions for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFinance;
