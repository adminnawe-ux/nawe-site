import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth } from 'date-fns';

const TherapistDashboard = () => {
  const { user } = useAuth();
  const [monthEarnings, setMonthEarnings] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: therapist } = await supabase
        .from('therapists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!therapist) return;

      // RLS already restricts this to payment_status='paid' sessions only.
      const { data: sessions } = await supabase
        .from('sessions')
        .select('currency, therapist_payout, scheduled_at')
        .eq('therapist_id', therapist.id)
        .gte('scheduled_at', startOfMonth(new Date()).toISOString());

      const total = (sessions ?? []).reduce((sum, s) => sum + (s.therapist_payout ?? 0), 0);
      const currency = sessions?.[0]?.currency ?? 'KES';
      setMonthEarnings(`${currency} ${total.toLocaleString()}`);
    };
    load();
  }, [user]);

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground mb-2">Therapist Dashboard</h1>
      <p className="font-body text-muted-foreground mb-10">Here's your day at a glance.</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Today\'s Sessions', value: '0' },
          { label: 'This Week', value: '0' },
          { label: 'Unread Messages', value: '0' },
          { label: 'Earnings (Month)', value: monthEarnings ?? 'KES 0' },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-card p-6 shadow-card border border-border">
            <p className="font-ui text-sm text-muted-foreground">{s.label}</p>
            <p className="font-display text-2xl text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TherapistDashboard;
