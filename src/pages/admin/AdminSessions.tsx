import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  CalendarCheck, Clock, Search, Filter, Video, Phone, MapPin,
  MessageCircle, ChevronLeft, ChevronRight, Loader2, Eye
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface SessionRow {
  id: string;
  scheduled_at: string;
  status: string | null;
  session_format: string | null;
  duration_minutes: number | null;
  price: number | null;
  currency: string | null;
  notes_client: string | null;
  notes_therapist: string | null;
  cancellation_reason: string | null;
  created_at: string;
  client_id: string;
  therapist_id: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning/15 text-warning border-warning/30',
  confirmed: 'bg-success/15 text-success border-success/30',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const FORMAT_ICONS: Record<string, React.ElementType> = {
  'Video Call': Video, 'Phone Call': Phone, 'In-Person': MapPin, 'Chat / Messaging': MessageCircle,
  video: Video, phone: Phone, in_person: MapPin, messaging: MessageCircle,
};

const PAGE_SIZE = 20;

const AdminSessions = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Profiles & therapist name cache
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [therapistNames, setTherapistNames] = useState<Record<string, string>>({});

  const fetchSessions = async () => {
    setLoading(true);
    let query = supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .order('scheduled_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, count, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSessions(data ?? []);
      setTotal(count ?? 0);

      // Resolve names
      const clientIds = [...new Set((data ?? []).map((s) => s.client_id))];
      const therapistIds = [...new Set((data ?? []).map((s) => s.therapist_id))];

      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', clientIds);
        const map: Record<string, string> = {};
        (profiles ?? []).forEach((p) => {
          map[p.user_id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown';
        });
        setClientNames(map);
      }

      if (therapistIds.length > 0) {
        const { data: therapists } = await supabase
          .from('therapists')
          .select('id, user_id')
          .in('id', therapistIds);
        if (therapists && therapists.length > 0) {
          const tUserIds = therapists.map((t) => t.user_id);
          const { data: tProfiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', tUserIds);
          const idMap: Record<string, string> = {};
          therapists.forEach((t) => {
            const prof = (tProfiles ?? []).find((p) => p.user_id === t.user_id);
            idMap[t.id] = prof ? `${prof.first_name ?? ''} ${prof.last_name ?? ''}`.trim() || 'Therapist' : 'Therapist';
          });
          setTherapistNames(idMap);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [page, statusFilter]);

  const updateStatus = async (sessionId: string, status: string) => {
    setUpdatingId(sessionId);
    const { error } = await supabase.from('sessions').update({ status }).eq('id', sessionId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, status } : s));
      toast({ title: 'Updated', description: `Session marked as ${status}.` });
    }
    setUpdatingId(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const stats = {
    total,
    pending: sessions.filter((s) => s.status === 'pending').length,
    confirmed: sessions.filter((s) => s.status === 'confirmed').length,
    cancelled: sessions.filter((s) => s.status === 'cancelled').length,
  };

  const filtered = search
    ? sessions.filter((s) => {
        const cn = clientNames[s.client_id]?.toLowerCase() ?? '';
        const tn = therapistNames[s.therapist_id]?.toLowerCase() ?? '';
        return cn.includes(search.toLowerCase()) || tn.includes(search.toLowerCase());
      })
    : sessions;

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground mb-2">Session Management</h1>
      <p className="font-body text-muted-foreground mb-8">Monitor all platform sessions and handle disputes.</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Sessions', value: total, icon: CalendarCheck, color: 'text-primary' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-warning' },
          { label: 'Confirmed', value: stats.confirmed, icon: CalendarCheck, color: 'text-success' },
          { label: 'Cancelled', value: stats.cancelled, icon: CalendarCheck, color: 'text-destructive' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-ui text-xs text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="font-display text-2xl text-foreground">{loading ? '—' : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client or therapist name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 font-ui text-sm rounded-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 font-ui text-sm rounded-full">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
          <CardContent className="p-12 text-center">
            <CalendarCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-body text-muted-foreground">No sessions found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 font-ui text-xs text-muted-foreground">Date & Time</th>
                  <th className="text-left px-5 py-3 font-ui text-xs text-muted-foreground">Client</th>
                  <th className="text-left px-5 py-3 font-ui text-xs text-muted-foreground">Therapist</th>
                  <th className="text-left px-5 py-3 font-ui text-xs text-muted-foreground">Format</th>
                  <th className="text-left px-5 py-3 font-ui text-xs text-muted-foreground">Price</th>
                  <th className="text-left px-5 py-3 font-ui text-xs text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 font-ui text-xs text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const FormatIcon = FORMAT_ICONS[s.session_format ?? ''] ?? Clock;
                  const statusStyle = STATUS_STYLES[s.status ?? 'pending'] ?? STATUS_STYLES.pending;

                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-ui text-sm text-foreground">{format(parseISO(s.scheduled_at), 'd MMM yyyy')}</p>
                        <p className="font-ui text-xs text-muted-foreground">{format(parseISO(s.scheduled_at), 'h:mm a')}</p>
                      </td>
                      <td className="px-5 py-3 font-ui text-sm text-foreground">
                        {clientNames[s.client_id] ?? 'Unknown'}
                      </td>
                      <td className="px-5 py-3 font-ui text-sm text-foreground">
                        {therapistNames[s.therapist_id] ?? 'Unknown'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 font-ui text-xs text-muted-foreground">
                          <FormatIcon className="h-3.5 w-3.5" /> {s.session_format ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-ui text-sm text-foreground">
                        {s.price ? `${s.currency ?? 'KES'} ${s.price.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className={`text-[10px] font-ui ${statusStyle}`}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Detail dialog */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-[var(--radius-card)]">
                              <DialogHeader>
                                <DialogTitle className="font-display text-xl">Session Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 font-ui text-sm">
                                <div className="grid grid-cols-2 gap-3">
                                  <div><span className="text-muted-foreground">Client</span><p className="text-foreground font-medium">{clientNames[s.client_id] ?? 'Unknown'}</p></div>
                                  <div><span className="text-muted-foreground">Therapist</span><p className="text-foreground font-medium">{therapistNames[s.therapist_id] ?? 'Unknown'}</p></div>
                                  <div><span className="text-muted-foreground">Date</span><p className="text-foreground">{format(parseISO(s.scheduled_at), 'EEEE, d MMM yyyy')}</p></div>
                                  <div><span className="text-muted-foreground">Time</span><p className="text-foreground">{format(parseISO(s.scheduled_at), 'h:mm a')}</p></div>
                                  <div><span className="text-muted-foreground">Format</span><p className="text-foreground">{s.session_format ?? '—'}</p></div>
                                  <div><span className="text-muted-foreground">Duration</span><p className="text-foreground">{s.duration_minutes ?? 50} min</p></div>
                                  <div><span className="text-muted-foreground">Price</span><p className="text-foreground">{s.price ? `${s.currency ?? 'KES'} ${s.price.toLocaleString()}` : '—'}</p></div>
                                  <div><span className="text-muted-foreground">Status</span><Badge variant="outline" className={`text-[10px] ${statusStyle}`}>{s.status}</Badge></div>
                                </div>
                                {s.notes_client && (
                                  <>
                                    <Separator />
                                    <div><span className="text-muted-foreground">Client Notes</span><p className="text-foreground mt-1">{s.notes_client}</p></div>
                                  </>
                                )}
                                {s.cancellation_reason && (
                                  <>
                                    <Separator />
                                    <div><span className="text-destructive">Cancellation Reason</span><p className="text-foreground mt-1">{s.cancellation_reason}</p></div>
                                  </>
                                )}
                                <Separator />
                                <div className="flex gap-2">
                                  {s.status === 'pending' && (
                                    <>
                                      <Button size="sm" className="font-ui rounded-full flex-1" onClick={() => updateStatus(s.id, 'confirmed')} disabled={updatingId === s.id}>
                                        {updatingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                                      </Button>
                                      <Button size="sm" variant="destructive" className="font-ui rounded-full flex-1" onClick={() => updateStatus(s.id, 'cancelled')} disabled={updatingId === s.id}>
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                  {s.status === 'confirmed' && (
                                    <Button size="sm" className="font-ui rounded-full flex-1" onClick={() => updateStatus(s.id, 'completed')} disabled={updatingId === s.id}>
                                      Mark Completed
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="font-ui text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="font-ui rounded-full" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button variant="outline" size="sm" className="font-ui rounded-full" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSessions;
