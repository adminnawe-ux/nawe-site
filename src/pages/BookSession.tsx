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
import {
  ArrowLeft, Video, Phone, MapPin, MessageCircle,
  Shield, Loader2, CheckCircle2, Smartphone, AlertCircle,
} from 'lucide-react';
import { format, addDays, setHours, setMinutes, isBefore, startOfDay, getDay } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import { formatTherapistDisplayName } from '@/lib/therapist';
import { SUPPORT_PHONE } from '@/lib/site';

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

type Therapist = Tables<'therapists'>;

const FORMAT_ICONS: Record<string, React.ElementType> = {
  'Video Call': Video, 'Phone Call': Phone, 'In-Person': MapPin, 'Chat / Messaging': MessageCircle,
};

const FORMAT_TO_DB: Record<string, string> = {
  'Video Call': 'video', 'Phone Call': 'phone', 'In-Person': 'in_person', 'Chat / Messaging': 'messaging',
};


const BookSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();

  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<{ day_of_week: number; start_time: string; end_time: string }[]>([]);

  // Payment dialog state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [initiating, setInitiating] = useState(false);
  // STK push waiting state
  const [stkPending, setStkPending] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const [paymentError, setPaymentError] = useState('');

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
    setPhone('');
    setPaymentError('');
    setStkPending(false);
    setPaymentOpen(true);
  };

  const handleInitiatePayment = async () => {
    if (!user || !therapist || !selectedDate || !selectedTime || !selectedFormat) return;

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setPaymentError('Enter your M-Pesa phone number.');
      return;
    }
    if (/[^0-9+\s-]/.test(trimmedPhone)) {
      setPaymentError('Phone number must contain only digits.');
      return;
    }
    const digits = trimmedPhone.replace(/\D/g, '');
    const normalised = digits.startsWith('0') ? '254' + digits.slice(1) : digits;
    if (!/^2547\d{8}$/.test(normalised)) {
      setPaymentError('Enter a valid Safaricom number — 07XXXXXXXX or +2547XXXXXXXX (10 digits).');
      return;
    }

    const [hours, mins] = selectedTime.split(':').map(Number);
    const scheduledAt = setMinutes(setHours(selectedDate, hours), mins);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    setInitiating(true);
    setPaymentError('');
    try {
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone: trimmedPhone,
          therapist_id: therapist.id,
          client_id: user.id,
          scheduled_at: scheduledAt.toISOString(),
          session_format: FORMAT_TO_DB[selectedFormat] ?? selectedFormat,
          duration_minutes: 50,
          notes_client: notes || null,
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) {
        const serverMsg = (data as { error?: string } | null)?.error;
        throw new Error(serverMsg ?? error.message);
      }
      if (data?.error) throw new Error(data.error);

      setTransactionId(data.transaction_id);
      setSessionId(data.session_id);
      setPollCount(0);
      setStkPending(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isNetworkError = !msg || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed to send');
      setPaymentError(
        isNetworkError
          ? `Payment service is currently unavailable. Please try again or call us on ${SUPPORT_PHONE}.`
          : msg
      );
    } finally {
      setInitiating(false);
    }
  };

  const handlePollStatus = useCallback(async () => {
    if (!transactionId || !sessionId) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { setPollCount((c) => c + 1); return; }

    try {
      const { data, error } = await supabase.functions.invoke('query-stk-push', {
        body: { transaction_id: transactionId, session_id: sessionId },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw error;

      if (data?.status === 'confirmed') {
        setPaymentOpen(false);
        setStkPending(false);
        setSuccess(true);
        return;
      }

      if (data?.status === 'failed') {
        setStkPending(false);
        setPaymentError(data.reason ?? 'Payment was not completed. You can try again.');
        return;
      }

      // still pending — increment counter; caller decides when to stop
      setPollCount((c) => c + 1);
    } catch {
      setPollCount((c) => c + 1);
    }
  }, [transactionId, sessionId]);

  // Poll NCBA for payment status every 4 seconds while STK push is pending
  useEffect(() => {
    if (!stkPending) return;
    if (pollCount >= 15) {
      // ~60s — STK prompt expires in ~30s so this is more than enough
      setStkPending(false);
      setPaymentError('Payment not received. The M-Pesa prompt has expired — tap "Send M-Pesa Prompt" to try again.');
      return;
    }
    const timer = setTimeout(handlePollStatus, 4000);
    return () => clearTimeout(timer);
  }, [stkPending, pollCount, handlePollStatus]);

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
            <h2 className="font-display text-2xl text-foreground">Payment Submitted!</h2>
            <p className="font-body text-sm text-muted-foreground">
              Your payment details have been received. Our team will verify receipt in our account and
              you'll get a <strong>confirmation email</strong> once approved — usually within a few hours.
            </p>
            <p className="font-body text-sm text-muted-foreground">
              Session with <strong>{profileName || 'the therapist'}</strong> on{' '}
              <strong>{selectedDate && format(selectedDate, 'EEEE, d MMMM')}</strong> at{' '}
              <strong>{selectedTime}</strong>.
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
      <Dialog open={paymentOpen} onOpenChange={(open) => { if (!initiating && !stkPending) setPaymentOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Pay via M-Pesa</DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              {stkPending
                ? 'Waiting for payment confirmation…'
                : 'Enter your M-Pesa number and we\'ll send a payment prompt to your phone.'}
            </DialogDescription>
          </DialogHeader>

          {stkPending ? (
            /* Waiting for PIN screen */
            <div className="space-y-6 py-2">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-ui text-base font-medium text-foreground">Check your phone</p>
                  <p className="font-body text-sm text-muted-foreground">
                    Enter your M-Pesa PIN to pay{' '}
                    <strong>{therapist.currency ?? 'KES'} {(therapist.price_per_session ?? 0).toLocaleString()}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-muted/40 rounded-xl p-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <p className="font-body text-xs text-muted-foreground">
                  Waiting for confirmation… ({pollCount > 0 ? `${pollCount * 4}s elapsed` : 'just sent'})
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full font-ui rounded-full"
                onClick={() => { setStkPending(false); setPaymentError(''); }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            /* Phone number entry screen */
            <div className="space-y-5 py-2">
              {/* Amount summary */}
              <div className="bg-muted/40 rounded-xl p-4 flex justify-between items-center font-ui text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-display text-xl text-foreground font-semibold">
                  {therapist.currency ?? 'KES'} {(therapist.price_per_session ?? 0).toLocaleString()}
                </span>
              </div>

              {/* Phone input */}
              {(() => {
                const digits = phone.replace(/\D/g, '');
                const normalised = digits.startsWith('0') ? '254' + digits.slice(1) : digits;
                const hasInvalidChars = phone.length > 0 && /[^0-9+\s-]/.test(phone);
                const isValid = /^2547\d{8}$/.test(normalised);
                const isTooLong = digits.length > 12;
                const hint = hasInvalidChars ? 'Digits only'
                  : isTooLong ? 'Too many digits'
                  : null;
                return (
                  <div className="space-y-1.5">
                    <label className="font-ui text-sm font-medium text-foreground">M-Pesa Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 0712 345 678"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setPaymentError(''); }}
                      disabled={initiating}
                      className={`w-full font-ui text-base border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
                        hint ? 'border-destructive focus:ring-destructive/40'
                        : isValid ? 'border-success focus:ring-success/40'
                        : 'border-input'
                      }`}
                    />
                    {hint
                      ? <p className="font-body text-[11px] text-destructive">{hint}</p>
                      : isValid
                        ? <p className="font-body text-[11px] text-success">Looks good</p>
                        : <p className="font-body text-[11px] text-muted-foreground">07XXXXXXXX or +2547XXXXXXXX</p>
                    }
                  </div>
                );
              })()}

              {paymentError && (
                <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="font-body text-xs">{paymentError}</p>
                </div>
              )}

              <Button
                className="w-full font-ui rounded-full"
                onClick={handleInitiatePayment}
                disabled={initiating || !phone.trim()}
              >
                {initiating
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending prompt…</>
                  : <><Smartphone className="mr-2 h-4 w-4" /> Send M-Pesa Prompt</>
                }
              </Button>

              <p className="font-body text-[11px] text-muted-foreground text-center">
                You'll receive a pop-up on your phone to enter your M-Pesa PIN. Your session is confirmed instantly once payment is received.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookSession;
