import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import SessionLinkEditor from '@/components/therapist/SessionLinkEditor';
import {
  ChevronLeft, ChevronRight, Clock, Video, Phone, MapPin, MessageCircle,
  Calendar as CalendarIcon, Check, X, Loader2, Link2
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday,
  parseISO, setHours, setMinutes
} from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Session = Tables<'sessions'>;

const FORMAT_ICON: Record<string, React.ElementType> = {
  'Video Call': Video, 'Phone Call': Phone, 'In-Person': MapPin, 'Chat / Messaging': MessageCircle,
  video: Video, phone: Phone, in_person: MapPin, messaging: MessageCircle,
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning/15 text-warning border-warning/30',
  confirmed: 'bg-success/15 text-success border-success/30',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const TherapistCalendar = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch therapist ID and sessions
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: therapist } = await supabase
        .from('therapists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (therapist) {
        setTherapistId(therapist.id);
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const { data: rows } = await supabase
          .from('sessions')
          .select('*')
          .eq('therapist_id', therapist.id)
          .gte('scheduled_at', start.toISOString())
          .lte('scheduled_at', end.toISOString())
          .order('scheduled_at', { ascending: true });

        setSessions(rows ?? []);
      }
      setLoading(false);
    };
    load();
  }, [user, currentMonth]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const sessionsOnDate = (date: Date) =>
    sessions.filter((s) => isSameDay(parseISO(s.scheduled_at), date));

  const selectedSessions = selectedDate ? sessionsOnDate(selectedDate) : [];

  const updateSessionStatus = async (sessionId: string, status: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    setUpdatingId(sessionId);
    const { error } = await supabase
      .from('sessions')
      .update({ status })
      .eq('id', sessionId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status } : s))
      );
      const { error: notifyError } = await supabase.functions.invoke('session-status-notify', {
        body: { session_id: sessionId, status },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (notifyError) {
        console.error('Session status notification failed:', notifyError);
      }
      toast({ title: 'Session updated', description: `Session marked as ${status}.` });
    }
    setUpdatingId(null);
  };

  const sessionCount = sessions.filter((s) => s.status !== 'cancelled').length;
  const pendingCount = sessions.filter((s) => s.status === 'pending').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-foreground mb-1">Calendar</h1>
          <p className="font-body text-muted-foreground text-sm">Manage your sessions and availability.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="font-ui text-xs">
            {sessionCount} session{sessionCount !== 1 && 's'} this month
          </Badge>
          {pendingCount > 0 && (
            <Badge className="font-ui text-xs bg-warning text-warning-foreground">
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <Card className="lg:col-span-2 rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-xl">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-full h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }} className="font-ui text-xs rounded-full">
                  Today
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-full h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center font-ui text-[10px] text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const daySessions = sessionsOnDate(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`relative h-16 sm:h-20 p-1 rounded-lg text-left transition-colors border ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : today
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-transparent hover:bg-muted/50'
                      } ${!inMonth ? 'opacity-30' : ''}`}
                    >
                      <span className={`font-ui text-xs ${today ? 'text-primary font-semibold' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </span>
                      {daySessions.length > 0 && (
                        <div className="flex gap-0.5 mt-1 flex-wrap">
                          {daySessions.slice(0, 3).map((s) => (
                            <div
                              key={s.id}
                              className={`h-1.5 w-1.5 rounded-full ${
                                s.status === 'confirmed' ? 'bg-success'
                                : s.status === 'pending' ? 'bg-warning'
                                : s.status === 'cancelled' ? 'bg-destructive'
                                : 'bg-muted-foreground'
                              }`}
                            />
                          ))}
                          {daySessions.length > 3 && (
                            <span className="font-ui text-[8px] text-muted-foreground">+{daySessions.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day detail panel */}
        <Card className="rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg">
              {selectedDate ? format(selectedDate, 'EEEE, d MMMM') : 'Select a day'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="font-body text-sm text-muted-foreground">Click on a day to see your sessions.</p>
            ) : selectedSessions.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">No sessions scheduled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedSessions.map((s) => {
                  const FormatIcon = FORMAT_ICON[s.session_format ?? ''] ?? Clock;
                  const statusStyle = STATUS_STYLES[s.status ?? 'pending'] ?? STATUS_STYLES.pending;

                  return (
                    <div key={s.id} className="bg-muted/30 rounded-lg p-3 border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FormatIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-ui text-sm font-medium text-foreground">
                            {format(parseISO(s.scheduled_at), 'h:mm a')}
                          </span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-ui ${statusStyle}`}>
                          {s.status}
                        </Badge>
                      </div>
                      <div className="font-ui text-xs text-muted-foreground space-y-0.5">
                        <p>{s.duration_minutes ?? 50} min · {s.session_format ?? 'Not set'}</p>
                        {s.price && <p>{s.currency ?? 'KES'} {s.price.toLocaleString()}</p>}
                      </div>
                      {/* Session link for online sessions */}
                      {s.status === 'confirmed' && ['video', 'Video Call', 'phone', 'Phone Call', 'messaging', 'Chat / Messaging'].includes(s.session_format ?? '') && (
                        <div className="pt-1">
                          {s.session_link ? (
                            <a
                              href={s.session_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 font-ui text-xs text-primary hover:underline"
                            >
                              <Link2 className="h-3 w-3" /> Join session
                            </a>
                          ) : (
                            <SessionLinkEditor
                              sessionId={s.id}
                              currentLink={s.session_link}
                              onUpdate={(link) => {
                                setSessions((prev) =>
                                  prev.map((sess) => (sess.id === s.id ? { ...sess, session_link: link } : sess))
                                );
                              }}
                            />
                          )}
                        </div>
                      )}
                      {s.status === 'pending' && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="font-ui text-xs rounded-full flex-1"
                            onClick={() => updateSessionStatus(s.id, 'confirmed')}
                            disabled={updatingId === s.id}
                          >
                            {updatingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="mr-1 h-3 w-3" /> Confirm</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="font-ui text-xs rounded-full text-destructive"
                            onClick={() => updateSessionStatus(s.id, 'cancelled')}
                            disabled={updatingId === s.id}
                          >
                            <X className="mr-1 h-3 w-3" /> Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-6 font-ui text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Confirmed</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Pending</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Cancelled</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Completed</span>
      </div>
    </div>
  );
};

export default TherapistCalendar;
