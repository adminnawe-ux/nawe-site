import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Video, Phone, MapPin, MessageCircle,
  CalendarIcon, Shield, Loader2, CheckCircle2, Copy, Check, RefreshCw, Smartphone,
} from 'lucide-react';
import { format, addDays, setHours, setMinutes, isBefore, startOfDay, getDay } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import { formatTherapistDisplayName } from '@/lib/therapist';

const generateTimeSlots = (start: string, end: string): string[] => {
  const slots: string[] = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current + 50 <= endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += 60;
  }
  return slots;
};

function generatePaymentRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `NW${rand}`;
}

type Therapist = Tables<'therapists'>;

const FORMAT_ICONS: Record<string, React.ElementType> = {
  'Video Call': Video, 'Phone Call': Phone, 'In-Person': MapPin, 'Chat / Messaging': MessageCircle,
};

const FORMAT_TO_DB: Record<string, string> = {
  'Video Call': 'video', 'Phone Call': 'phone', 'In-Person': 'in_person', 'Chat / Messaging': 'messaging',
};

// These should match your NCBA M-Pesa Paybill setup
const MPESA_PAYBILL = import.meta.env.VITE_MPESA_PAYBILL ?? '880100';

const BookSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();

  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [successSessionId, setSuccessSessionId] = useState<string | null>(null);

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<{ day_of_week: number; start_time: string; end_time: string }[]>([]);

  // Payment dialog state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

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
    if (roles.includes('therapist') || !id) return;
    const load = async () => {
      setLoading(true);
      const { data: t } = await supabase.from('therapists').select('*').eq('id', id).maybeSingle();
      setTherapist(t);
      if (t) {
        const { data: p } = await supabase
          .from('therapist_public_profiles').select('first_name, last_name')
          .eq('user_id', t.user_id).maybeSingle();
        setProfileName(formatTherapistDisplayName(p?.first_name, p?.last_name));
        if ((t.session_formats ?? []).length > 0) setSelectedFormat(t.session_formats![0]);
        const { data: avail } = await supabase
          .from('therapist_availability').select('day_of_week, start_time, end_time')
          .eq('therapist_id', id).eq('is_active', true);
        setAvailability(avail ?? []);
      }
      setLoading(false);
    };
    load();
  }, [id, roles]);

  const openPaymentDialog = () => {
    setPaymentRef(generatePaymentRef());
    setPaymentOpen(true);
  };

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy', description: 'Please copy the reference manually.', variant: 'destructive' });
    }
  }, []);

  const handleVerifyPayment = async () => {
    if (!user || !therapist || !selectedDate || !selectedTime || !selectedFormat) return;

    const [hours, mins] = selectedTime.split(':').map(Number);
    const scheduledAt = setMinutes(setHours(selectedDate, hours), mins);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          payment_reference: paymentRef,
          expected_amount: therapist.price_per_session ?? 0,
          currency: therapist.currency ?? 'KES',
          therapist_id: therapist.id,
          client_id: user.id,
          scheduled_at: scheduledAt.toISOString(),
          session_format: FORMAT_TO_DB[selectedFormat] ?? selectedFormat,
          duration_minutes: 50,
          notes_client: notes || null,
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) throw error;

      if (!data.verified) {
        toast({
          title: 'Payment not found yet',
          description: data.message ?? 'Please wait a moment after sending and try again.',
          variant: 'destructive',
        });
        return;
      }

      // Payment verified — send booking notification then show success
      if (data.session_id) {
        await supabase.functions.invoke('booking-notify', {
          body: { session_id: data.session_id },
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        setSuccessSessionId(data.session_id);
      }

      setPaymentOpen(false);
      setSuccess(true);
      toast({ title: 'Payment verified!', description: 'Your session has been booked successfully.' });
    } catch (err) {
      toast({
        title: 'Verification failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
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
            <h2 className="font-display text-2xl text-foreground">Session Booked!</h2>
            <p className="font-body text-sm text-muted-foreground">
              Your payment was confirmed and your session with{' '}
              <strong>{profileName || 'the therapist'}</strong> on{' '}
              <strong>{selectedDate && format(selectedDate, 'EEEE, d MMMM')}</strong> at{' '}
              <strong>{selectedTime}</strong> has been submitted. Your therapist will confirm shortly.
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
          {/* Left – form steps */}
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
              const jsDay = getDay(selectedDate);
              const schemaDay = jsDay === 0 ? 6 : jsDay - 1;
              const dayAvail = availability.filter((a) => a.day_of_week === schemaDay);
              const hasAnyAvailability = availability.length > 0;
              const timeSlots = dayAvail.length > 0
                ? dayAvail.flatMap((a) => generateTimeSlots(a.start_time, a.end_time))
                : hasAnyAvailability
                  ? []
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
                          active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card'
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
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-display text-lg text-primary">{(displayName || displayTitle || 'T').charAt(0)}</span>
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
                    disabled={!isComplete}
                    onClick={openPaymentDialog}
                  >
                    <Smartphone className="mr-2 h-4 w-4" /> Proceed to Pay
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

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={(open) => { if (!verifying) setPaymentOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Pay via M-Pesa</DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              Send the exact amount below to our NCBA Paybill, then tap "I've Paid" to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Payment instructions */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-3 font-ui text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Paybill Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-base tracking-wider">{MPESA_PAYBILL}</span>
                  <button onClick={() => copyToClipboard(MPESA_PAYBILL)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground text-base tracking-widest">{paymentRef}</span>
                  <button onClick={() => copyToClipboard(paymentRef)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground text-base">
                  {therapist.currency ?? 'KES'} {(therapist.price_per_session ?? 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <ol className="space-y-1.5 font-body text-xs text-muted-foreground list-decimal list-inside">
              <li>Open M-Pesa on your phone and go to <strong>Lipa na M-Pesa → Pay Bill</strong></li>
              <li>Enter Business No: <strong>{MPESA_PAYBILL}</strong></li>
              <li>Enter Account No: <strong>{paymentRef}</strong> (use this exactly)</li>
              <li>Enter Amount: <strong>{therapist.currency ?? 'KES'} {(therapist.price_per_session ?? 0).toLocaleString()}</strong></li>
              <li>Enter your M-Pesa PIN and confirm</li>
            </ol>

            <div className="flex gap-3 pt-1">
              <Button
                className="flex-1 font-ui rounded-full"
                onClick={handleVerifyPayment}
                disabled={verifying}
              >
                {verifying
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                  : <><Check className="mr-2 h-4 w-4" /> I've Paid</>
                }
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full shrink-0"
                onClick={handleVerifyPayment}
                disabled={verifying}
                title="Retry verification"
              >
                <RefreshCw className={`h-4 w-4 ${verifying ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <p className="font-body text-[11px] text-muted-foreground text-center">
              Payment may take up to 30 seconds to reflect. If not found, wait and tap retry.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookSession;
