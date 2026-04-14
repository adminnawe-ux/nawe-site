import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Video, Phone, MapPin, MessageCircle, Clock,
  CalendarIcon, Shield, Loader2, CheckCircle2
} from 'lucide-react';
import { format, addDays, setHours, setMinutes, isBefore, startOfDay, getDay } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import { formatTherapistDisplayName } from '@/lib/therapist';

/** Generate half-hour time slots between start and end times */
const generateTimeSlots = (start: string, end: string): string[] => {
  const slots: string[] = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current + 50 <= endMin) { // 50min session must fit
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += 60; // hourly slots
  }
  return slots;
};

type Therapist = Tables<'therapists'>;

const FORMAT_ICONS: Record<string, React.ElementType> = {
  'Video Call': Video,
  'Phone Call': Phone,
  'In-Person': MapPin,
  'Chat / Messaging': MessageCircle,
};

// Map display names (stored in therapists.session_formats) to DB enum values (sessions.session_format check constraint)
const FORMAT_TO_DB: Record<string, string> = {
  'Video Call': 'video',
  'Phone Call': 'phone',
  'In-Person': 'in_person',
  'Chat / Messaging': 'messaging',
};

const BookSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();

  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<{ day_of_week: number; start_time: string; end_time: string }[]>([]);

  useEffect(() => {
    if (roles.includes('therapist')) {
      navigate('/therapist-portal/profile-edit', { replace: true });
    }
  }, [navigate, roles]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/login?redirect_to=${encodeURIComponent(`/book/${id ?? ''}`)}`, { replace: true });
    }
  }, [authLoading, id, navigate, user]);

  useEffect(() => {
    if (roles.includes('therapist')) return;

    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: t } = await supabase.from('therapists').select('*').eq('id', id).maybeSingle();
      setTherapist(t);
      if (t) {
        const { data: p } = await supabase.from('therapist_public_profiles').select('first_name, last_name').eq('user_id', t.user_id).maybeSingle();
        setProfileName(formatTherapistDisplayName(p?.first_name, p?.last_name));
        if ((t.session_formats ?? []).length > 0) {
          setSelectedFormat(t.session_formats![0]);
        }
        // Load availability
        const { data: avail } = await supabase
          .from('therapist_availability')
          .select('day_of_week, start_time, end_time')
          .eq('therapist_id', id)
          .eq('is_active', true);
        setAvailability(avail ?? []);
      }
      setLoading(false);
    };
    load();
  }, [id, roles]);

  const handleBook = async () => {
    if (!user || !therapist || !selectedDate || !selectedTime || !selectedFormat) return;

    const [hours, mins] = selectedTime.split(':').map(Number);
    const scheduledAt = setMinutes(setHours(selectedDate, hours), mins);

    setSubmitting(true);
    const { data: booking, error } = await supabase
      .from('sessions')
      .insert({
      therapist_id: therapist.id,
      client_id: user.id,
      scheduled_at: scheduledAt.toISOString(),
      session_format: FORMAT_TO_DB[selectedFormat] ?? selectedFormat,
      duration_minutes: 50,
      price: therapist.price_per_session,
      currency: therapist.currency ?? 'KES',
      status: 'pending',
      notes_client: notes || null,
      })
      .select('id')
      .single();

    if (error) {
      toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
    } else {
      if (booking?.id) {
        const { error: notifyError } = await supabase.functions.invoke('booking-notify', {
          body: { session_id: booking.id },
        });

        if (notifyError) {
          console.error('Booking notification failed:', notifyError);
        }
      }
      setSuccess(true);
      toast({ title: 'Session booked!', description: 'Your therapist will confirm shortly.' });
    }
    setSubmitting(false);
  };

  const isComplete = selectedDate && selectedTime && selectedFormat;

  if (roles.includes('therapist')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="font-ui text-muted-foreground">Redirecting…</p>
        </div>
      </div>
    );
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="font-ui text-muted-foreground">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-10 max-w-3xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
        </div>
      </div>
    );
  }

  if (!therapist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-display text-2xl text-foreground mb-2">Therapist not found</h2>
          <Button variant="outline" onClick={() => navigate('/matches')} className="font-ui rounded-full mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to directory
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-6 rounded-[var(--radius-card)] shadow-[var(--shadow-soft)]">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="font-display text-2xl text-foreground">Booking Confirmed</h2>
            <p className="font-body text-sm text-muted-foreground">
              Your session with {profileName || 'the therapist'} on{' '}
              <strong>{selectedDate && format(selectedDate, 'EEEE, d MMMM')}</strong> at{' '}
              <strong>{selectedTime}</strong> has been submitted. You'll be notified once confirmed.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 font-ui rounded-full" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button className="flex-1 font-ui rounded-full" onClick={() => navigate(`/therapist/${id}`)}>
                View Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = profileName.trim();
  const displayTitle = therapist.professional_title?.trim() ?? '';
  const formats = therapist.session_formats ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-5 max-w-3xl">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-ui text-sm transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="font-display text-2xl text-foreground">Book a Session</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Schedule a session with {displayName || displayTitle || 'Therapist'}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Left – form */}
          <div className="md:col-span-3 space-y-8">
            {/* Step 1: Date */}
            <div>
              <h3 className="font-display text-lg text-foreground mb-3 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-ui">1</span>
                Choose a Date
              </h3>
              <Card className="rounded-[var(--radius-card)]">
                <CardContent className="p-4 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                    disabled={(date) => isBefore(date, startOfDay(new Date())) || isBefore(date, addDays(new Date(), -1))}
                    className="p-3 pointer-events-auto"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Step 2: Time */}
            {selectedDate && (() => {
              // Convert JS getDay (0=Sun) to our schema (0=Mon)
              const jsDay = getDay(selectedDate); // 0=Sun, 1=Mon...
              const schemaDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, 6=Sun
              const dayAvail = availability.filter((a) => a.day_of_week === schemaDay);
              const hasAnyAvailability = availability.length > 0;
              const timeSlots = dayAvail.length > 0
                ? dayAvail.flatMap((a) => generateTimeSlots(a.start_time, a.end_time))
                : hasAnyAvailability
                  ? [] // Therapist set availability but not for this day
                  : ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
              const uniqueSlots = [...new Set(timeSlots)].sort();

              return (
                <div>
                  <h3 className="font-display text-lg text-foreground mb-3 flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-ui">2</span>
                    Pick a Time
                  </h3>
                  {uniqueSlots.length === 0 ? (
                    <p className="font-body text-sm text-muted-foreground">This therapist isn't available on this day. Please choose another date.</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {uniqueSlots.map((slot) => (
                        <Button
                          key={slot}
                          variant={selectedTime === slot ? 'default' : 'outline'}
                          size="sm"
                          className="font-ui text-xs rounded-full"
                          onClick={() => setSelectedTime(slot)}
                        >
                          {slot}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Step 3: Format */}
            {selectedTime && formats.length > 0 && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-ui">3</span>
                  Session Format
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {formats.map((f) => {
                    const Icon = FORMAT_ICONS[f] ?? Video;
                    const active = selectedFormat === f;
                    return (
                      <button
                        key={f}
                        onClick={() => setSelectedFormat(f)}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
                          active
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40 bg-card'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`font-ui text-sm ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{f}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Notes */}
            {isComplete && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-ui">4</span>
                  Notes <span className="font-ui text-xs text-muted-foreground">(optional)</span>
                </h3>
                <Textarea
                  placeholder="Anything you'd like the therapist to know before your session..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="font-body rounded-xl resize-none"
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Right – summary card */}
          <div className="md:col-span-2">
            <div className="sticky top-8">
              <Card className="rounded-[var(--radius-card)] shadow-[var(--shadow-soft)]">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-lg">Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Therapist info */}
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-display text-lg text-primary">{(displayName || displayTitle || 'Therapist').charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-ui text-sm font-medium text-foreground">{displayName || displayTitle || 'Therapist'}</p>
                      {displayName && displayTitle && (
                        <p className="font-ui text-xs text-muted-foreground">{displayTitle}</p>
                      )}
                      {therapist.verified && (
                        <span className="flex items-center gap-1 font-ui text-[10px] text-success">
                          <Shield className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3 font-ui text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="text-foreground">{selectedDate ? format(selectedDate, 'd MMM yyyy') : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span className="text-foreground">{selectedTime ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Format</span>
                      <span className="text-foreground">{selectedFormat ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="text-foreground">50 min</span>
                    </div>
                  </div>

                  <Separator />

                  {therapist.price_per_session && (
                    <div className="flex justify-between items-center">
                      <span className="font-ui text-sm text-muted-foreground">Total</span>
                      <span className="font-display text-xl text-foreground">
                        {therapist.currency ?? 'KES'} {therapist.price_per_session.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <Button
                    className="w-full font-ui rounded-full mt-2"
                    disabled={!isComplete || submitting}
                    onClick={handleBook}
                  >
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Booking...</>
                    ) : (
                      <><CalendarIcon className="mr-2 h-4 w-4" /> Confirm Booking</>
                    )}
                  </Button>

                  {therapist.cancellation_policy && (
                    <p className="font-body text-[11px] text-muted-foreground text-center leading-relaxed">
                      {therapist.cancellation_policy}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookSession;
