import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, Calendar, Clock, MapPin, Users, ExternalLink, Loader2, CheckCircle2, Smartphone, ArrowLeft, Ticket } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { SUPPORT_PHONE } from '@/lib/site';

interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  organizer_name: string | null;
  location: string | null;
  location_url: string | null;
  starts_at: string;
  ends_at: string | null;
  is_free: boolean;
  price: number | null;
  currency: string;
  capacity: number | null;
  status: string;
}

const EventDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // STK push polling state
  const [stkPending, setStkPending] = useState(false);
  const [registrationId, setRegistrationId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [pollCount, setPollCount] = useState(0);

  // Success state
  const [ticketCode, setTicketCode] = useState('');

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      supabase.from('events').select('*').eq('slug', slug).eq('status', 'published').maybeSingle(),
    ]).then(([{ data }]) => {
      setEvent(data);
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    if (!event) return;
    // Registration count
    supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .in('payment_status', ['free', 'paid', 'pending_stk'])
      .then(({ count }) => setRegistrationCount(count ?? 0));

    // Check if logged-in user already registered
    if (user) {
      supabase
        .from('event_registrations')
        .select('id, ticket_code')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .in('payment_status', ['free', 'paid'])
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setAlreadyRegistered(true);
            setTicketCode(data.ticket_code);
          }
        });
    }
  }, [event, user]);

  // Pre-fill form from logged-in user
  useEffect(() => {
    if (user && dialogOpen) {
      setEmail(user.email ?? '');
    }
  }, [user, dialogOpen]);

  // Poll for payment confirmation
  useEffect(() => {
    if (!stkPending) return;
    if (pollCount >= 15) {
      setStkPending(false);
      setError('M-Pesa prompt expired — tap "Send M-Pesa Prompt" to try again.');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) { setPollCount(c => c + 1); return; }

        const { data, error: invokeErr } = await supabase.functions.invoke('query-event-payment', {
          body: { transaction_id: transactionId, registration_id: registrationId },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (invokeErr) { setPollCount(c => c + 1); return; }

        if (data?.status === 'confirmed') {
          setStkPending(false);
          setTicketCode(data.ticket_code);
          setAlreadyRegistered(true);
          setDialogOpen(false);
          return;
        }
        if (data?.status === 'failed') {
          setStkPending(false);
          setError(data.reason ?? 'Payment was not completed. Please try again.');
          return;
        }
        setPollCount(c => c + 1);
      } catch {
        setPollCount(c => c + 1);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [stkPending, pollCount, transactionId, registrationId]);

  const openDialog = () => {
    setError('');
    setPhone('');
    setStkPending(false);
    setDialogOpen(true);
  };

  const handleRegister = async () => {
    if (!event) return;
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email.'); return; }

    if (!event.is_free) {
      const digits = phone.replace(/\D/g, '');
      const normalised = digits.startsWith('0') ? '254' + digits.slice(1) : digits;
      if (!/^2547\d{8}$/.test(normalised)) {
        setError('Enter a valid Safaricom number — 07XXXXXXXX.');
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const { data, error: invokeErr } = await supabase.functions.invoke('register-event', {
        body: {
          event_id: event.id,
          attendee_name: name.trim(),
          attendee_email: email.trim(),
          phone: event.is_free ? undefined : phone.trim(),
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (invokeErr) {
        const serverMsg = (data as { error?: string } | null)?.error;
        throw new Error(serverMsg ?? invokeErr.message);
      }
      if (data?.error) throw new Error(data.error);

      if (event.is_free) {
        setTicketCode(data.ticket_code);
        setAlreadyRegistered(true);
        setDialogOpen(false);
      } else {
        setRegistrationId(data.registration_id);
        setTransactionId(data.transaction_id);
        setPollCount(0);
        setStkPending(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isNetwork = !msg || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed to send');
      setError(isNetwork
        ? `Service unavailable. Please try again or call ${SUPPORT_PHONE}.`
        : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-10 max-w-3xl space-y-6">
          <Skeleton className="aspect-[16/9] w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-display text-2xl mb-2">Event not found</h2>
          <Button variant="outline" onClick={() => navigate('/events')} className="font-ui rounded-full mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const upcoming = isFuture(new Date(event.starts_at));
  const spotsLeft = event.capacity ? event.capacity - registrationCount : null;
  const soldOut = spotsLeft !== null && spotsLeft <= 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-10 max-w-3xl">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-ui text-sm transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> All Events
        </button>

        {/* Poster */}
        {event.poster_url && (
          <div className="rounded-[var(--radius-card)] overflow-hidden mb-8 border border-border">
            <img src={event.poster_url} alt={event.title} className="w-full object-cover max-h-[480px]" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-start gap-3 mb-2">
                <h1 className="font-display text-3xl text-foreground flex-1">{event.title}</h1>
                <Badge variant={event.is_free ? 'secondary' : 'default'} className="shrink-0 mt-1">
                  {event.is_free ? 'Free' : `${event.currency} ${(event.price ?? 0).toLocaleString()}`}
                </Badge>
              </div>
              {event.organizer_name && (
                <p className="font-body text-muted-foreground">Hosted by {event.organizer_name}</p>
              )}
            </div>

            {event.description && (
              <div>
                <h2 className="font-display text-lg text-foreground mb-2">About this event</h2>
                <p className="font-body text-muted-foreground leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-[var(--radius-card)] border border-border bg-card p-5 space-y-4">
              <div className="space-y-3 text-sm font-ui">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-foreground font-medium">{format(new Date(event.starts_at), 'EEEE, d MMMM yyyy')}</p>
                    <p className="text-muted-foreground">
                      {format(new Date(event.starts_at), 'h:mm a')}
                      {event.ends_at && ` – ${format(new Date(event.ends_at), 'h:mm a')}`}
                    </p>
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-foreground">{event.location}</p>
                      {event.location_url && (
                        <a href={event.location_url} target="_blank" rel="noopener noreferrer"
                          className="text-primary text-xs flex items-center gap-1 hover:underline mt-0.5">
                          View on map <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {event.capacity && (
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">
                      {soldOut ? (
                        <span className="text-destructive font-medium">Sold out</span>
                      ) : (
                        <>{spotsLeft !== null ? `${spotsLeft} spots left` : `${registrationCount} registered`}</>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {ticketCode ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-success text-sm font-ui">
                    <CheckCircle2 className="h-4 w-4" />
                    You're registered!
                  </div>
                  <Button
                    className="w-full font-ui rounded-full"
                    variant="outline"
                    onClick={() => navigate(`/events/ticket/${ticketCode}`)}
                  >
                    <Ticket className="mr-2 h-4 w-4" /> View Ticket
                  </Button>
                </div>
              ) : upcoming && !soldOut ? (
                <Button
                  className="w-full font-ui rounded-full"
                  onClick={openDialog}
                >
                  {event.is_free ? 'Register — Free' : `Book — ${event.currency} ${(event.price ?? 0).toLocaleString()}`}
                </Button>
              ) : !upcoming ? (
                <p className="text-sm font-ui text-muted-foreground text-center">This event has ended.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Registration Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!submitting && !stkPending) setDialogOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {event.is_free ? 'Register for event' : 'Pay & Register'}
            </DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              {stkPending
                ? 'Check your phone for the M-Pesa prompt.'
                : event.is_free
                  ? 'Secure your spot — a confirmation email will be sent to you.'
                  : 'Enter your details and pay via M-Pesa.'}
            </DialogDescription>
          </DialogHeader>

          {stkPending ? (
            <div className="space-y-5 py-2">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-ui font-medium text-foreground">Check your phone</p>
                  <p className="font-body text-sm text-muted-foreground mt-1">
                    Enter your M-Pesa PIN to pay{' '}
                    <strong>{event.currency} {(event.price ?? 0).toLocaleString()}</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-muted/40 rounded-xl p-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <p className="font-body text-xs text-muted-foreground">
                  Waiting for confirmation… ({pollCount > 0 ? `${pollCount * 4}s` : 'just sent'})
                </p>
              </div>
              <Button variant="outline" className="w-full font-ui rounded-full"
                onClick={() => { setStkPending(false); setError(''); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {!event.is_free && (
                <div className="bg-muted/40 rounded-xl p-4 flex justify-between items-center font-ui text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-display text-xl font-semibold">
                    {event.currency} {(event.price ?? 0).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="font-ui text-sm font-medium text-foreground">Full Name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    disabled={submitting}
                    className="w-full font-ui text-sm border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-ui text-sm font-medium text-foreground">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    disabled={submitting}
                    className="w-full font-ui text-sm border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input transition-colors"
                  />
                </div>

                {!event.is_free && (
                  <div className="space-y-1.5">
                    <label className="font-ui text-sm font-medium text-foreground">M-Pesa Number</label>
                    <input
                      type="tel"
                      placeholder="07XXXXXXXX"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setError(''); }}
                      disabled={submitting}
                      className="w-full font-ui text-sm border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input transition-colors"
                    />
                    <p className="font-body text-[11px] text-muted-foreground">07XXXXXXXX or +2547XXXXXXXX</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="font-body text-xs">{error}</p>
                </div>
              )}

              <Button
                className="w-full font-ui rounded-full"
                onClick={handleRegister}
                disabled={submitting}
              >
                {submitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                  : event.is_free ? 'Confirm Registration' : 'Send M-Pesa Prompt'
                }
              </Button>

              <p className="font-body text-[11px] text-muted-foreground text-center">
                {event.is_free
                  ? 'A confirmation email with your ticket will be sent to the address above.'
                  : 'You\'ll receive a pop-up on your phone to enter your M-Pesa PIN.'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetail;
