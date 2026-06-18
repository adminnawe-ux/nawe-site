import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertCircle, Calendar, Clock, MapPin, Users, ExternalLink, Loader2,
  CheckCircle2, Smartphone, ArrowLeft, Ticket, ChevronLeft, Tag, Minus, Plus,
} from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { SUPPORT_PHONE } from '@/lib/site';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface TicketTier {
  id: string;
  name: string;
  ticket_type: 'individual' | 'group';
  group_size: number | null;
  price: number;
  currency: string;
  capacity: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  sort_order: number;
  // computed client-side
  soldCount?: number;
}

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

interface GroupMemberForm {
  name: string;
  email: string;
}

// Step 1: pick a tier
// Step 2: your details (+ phone if paid)
// Step 3: group members (only for group tiers)
type RegistrationStep = 'tier' | 'details' | 'group-members' | 'stk-pending';

function tierAvailable(tier: TicketTier, now: Date): { available: boolean; reason?: string } {
  if (tier.sale_starts_at && now < new Date(tier.sale_starts_at)) {
    return { available: false, reason: `Opens ${format(new Date(tier.sale_starts_at), 'd MMM, h:mm a')}` };
  }
  if (tier.sale_ends_at && now > new Date(tier.sale_ends_at)) {
    return { available: false, reason: 'Sale ended' };
  }
  if (tier.capacity !== null && (tier.soldCount ?? 0) >= tier.capacity) {
    return { available: false, reason: 'Sold out' };
  }
  return { available: true };
}

function tierLabel(tier: TicketTier): string {
  if (tier.ticket_type === 'group') return `Group of ${tier.group_size}`;
  return 'Individual';
}

const EventDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [approvedWaitlist, setApprovedWaitlist] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ registrationId: string; transactionId: string } | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<RegistrationStep>('tier');
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);

  // Step 2 — your details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 3 — group members
  const [groupMembers, setGroupMembers] = useState<GroupMemberForm[]>([]);

  const [isWaitlistJoin, setIsWaitlistJoin] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // STK polling
  const [stkPending, setStkPending] = useState(false);
  const [registrationId, setRegistrationId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [pollCount, setPollCount] = useState(0);
  // After fast polls exhaust, slow-poll for another minute before giving up
  const [stkSlowPoll, setStkSlowPoll] = useState(false);
  const [slowPollCount, setSlowPollCount] = useState(0);

  // Success
  const [ticketCode, setTicketCode] = useState('');

  const now = new Date();

  useEffect(() => {
    if (!slug) return;
    db.from('events').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
      .then(({ data }: { data: Event | null }) => {
        setEvent(data);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!event) return;

    // Overall registration count — must match ACTIVE_STATUSES in register-event
    db.from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .in('payment_status', ['free', 'paid', 'pending_stk', 'approved_waitlist'])
      .then(({ count }: { count: number | null }) => setRegistrationCount(count ?? 0));

    // Fetch tiers with sold counts
    db.from('event_ticket_tiers')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order')
      .then(async ({ data: tierData }: { data: TicketTier[] | null }) => {
        if (!tierData || tierData.length === 0) { setTiers([]); return; }

        // For each tier, get sold count
        const withCounts = await Promise.all(tierData.map(async (t: TicketTier) => {
          const { count } = await db.from('event_registrations')
            .select('id', { count: 'exact', head: true })
            .eq('tier_id', t.id)
            .in('payment_status', ['free', 'paid', 'pending_stk']);
          return { ...t, soldCount: count ?? 0 };
        }));
        setTiers(withCounts);
      });

    // Check if logged-in user already has a registration in any active state
    if (user) {
      db.from('event_registrations')
        .select('id, ticket_code, payment_status, tier_id, payment_reference')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .is('group_lead_id', null)
        .in('payment_status', ['free', 'paid', 'pending_stk', 'waitlisted', 'approved_waitlist'])
        .maybeSingle()
        .then(({ data }: { data: { id: string; ticket_code: string; payment_status: string; tier_id: string | null; payment_reference: string | null } | null }) => {
          if (!data) return;
          if (data.payment_status === 'free' || data.payment_status === 'paid') {
            setAlreadyRegistered(true);
            setTicketCode(data.ticket_code);
          } else if (data.payment_status === 'pending_stk') {
            setPendingPayment({ registrationId: data.id, transactionId: data.payment_reference ?? '' });
          } else if (data.payment_status === 'waitlisted') {
            setWaitlisted(true);
          } else if (data.payment_status === 'approved_waitlist') {
            setApprovedWaitlist(true);
            // Pre-select their tier so the payment dialog starts correctly
            if (data.tier_id) {
              const matchedTier = tiers.find(t => t.id === data.tier_id);
              if (matchedTier) setSelectedTier(matchedTier);
            }
          }
        });
    }
  }, [event, user]);

  // Pre-fill email from logged-in user
  useEffect(() => {
    if (user && dialogOpen) setEmail(user.email ?? '');
  }, [user, dialogOpen]);

  // STK fast poll — every 4 s for up to 30 polls (2 min)
  useEffect(() => {
    if (!stkPending) return;
    if (pollCount >= 30) {
      // Transition to slow-poll phase instead of giving up
      setStkPending(false);
      setStkSlowPoll(true);
      setSlowPollCount(0);
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
          setStep('details');
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

  // STK slow poll — every 15 s for up to 4 more checks (1 min) after fast polling ends
  useEffect(() => {
    if (!stkSlowPoll) return;
    if (slowPollCount >= 4) {
      // Truly give up — payment may still confirm via webhook, tell user to check ticket
      setStkSlowPoll(false);
      setStep('stk-pending'); // keep dialog open with final message
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) { setSlowPollCount(c => c + 1); return; }

        const { data, error: invokeErr } = await supabase.functions.invoke('query-event-payment', {
          body: { transaction_id: transactionId, registration_id: registrationId },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (invokeErr) { setSlowPollCount(c => c + 1); return; }

        if (data?.status === 'confirmed') {
          setStkSlowPoll(false);
          setTicketCode(data.ticket_code);
          setAlreadyRegistered(true);
          setDialogOpen(false);
          return;
        }
        if (data?.status === 'failed') {
          setStkSlowPoll(false);
          setStep('details');
          setError(data.reason ?? 'Payment was not completed. Please try again.');
          return;
        }
        setSlowPollCount(c => c + 1);
      } catch {
        setSlowPollCount(c => c + 1);
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [stkSlowPoll, slowPollCount, transactionId, registrationId]);

  const openDialog = (joinWaitlist = false) => {
    if (!user) {
      navigate(`/login?redirect_to=${encodeURIComponent(`/events/${event?.slug ?? slug}`)}`);
      return;
    }
    setError('');
    setPhone('');
    setSelectedTier(null);
    setGroupMembers([]);
    setQuantity(1);
    setStkPending(false);
    setStkSlowPoll(false);
    setSlowPollCount(0);
    setPollCount(0);
    setIsWaitlistJoin(joinWaitlist);
    setStep(tiers.length > 0 && !joinWaitlist ? 'tier' : 'details');
    setDialogOpen(true);
  };

  const handleTierSelect = (tier: TicketTier) => {
    setSelectedTier(tier);
    setError('');
    setStep('details');
  };

  const handleDetailsNext = () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email.'); return; }
    const isFree = !selectedTier || selectedTier.price === 0;
    if (!isFree && !isWaitlistJoin) {
      const digits = phone.replace(/\D/g, '');
      const normalised = digits.startsWith('0') ? '254' + digits.slice(1) : digits;
      if (!/^2547\d{8}$/.test(normalised)) { setError('Enter a valid Safaricom number — 07XXXXXXXX.'); return; }
    }
    // Group tier: fixed group_size - 1 extra members
    // Individual tier with quantity > 1: quantity - 1 extra attendees
    const extraNeeded = selectedTier?.ticket_type === 'group' && selectedTier.group_size
      ? selectedTier.group_size - 1
      : quantity - 1;
    if (extraNeeded > 0) {
      setGroupMembers(Array.from({ length: extraNeeded }, () => ({ name: '', email: '' })));
      setError('');
      setStep('group-members');
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async (members?: GroupMemberForm[]) => {
    if (!event) return;
    setSubmitting(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const isFree = !selectedTier || selectedTier.price === 0;

      const { data, error: invokeErr } = await supabase.functions.invoke('register-event', {
        body: {
          event_id: event.id,
          tier_id: selectedTier?.id,
          attendee_name: name.trim(),
          attendee_email: email.trim(),
          phone: isFree ? undefined : phone.trim(),
          quantity: selectedTier?.ticket_type !== 'group' ? quantity : undefined,
          group_members: members,
        },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (invokeErr) {
        const serverMsg = (data as { error?: string } | null)?.error;
        throw new Error(serverMsg ?? invokeErr.message);
      }
      if (data?.error) throw new Error(data.error);

      if (data?.waitlisted) {
        setWaitlisted(true);
        setDialogOpen(false);
        return;
      }
      if (isFree) {
        setTicketCode(data.ticket_code);
        setAlreadyRegistered(true);
        setDialogOpen(false);
      } else {
        setRegistrationId(data.registration_id);
        setTransactionId(data.transaction_id);
        setPollCount(0);
        setStkPending(true);
        setStep('stk-pending');
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

  const handleGroupMembersSubmit = () => {
    for (const m of groupMembers) {
      if (!m.name.trim()) { setError('Please enter a name for each group member.'); return; }
      if (!m.email.trim() || !m.email.includes('@')) { setError('Please enter a valid email for each group member.'); return; }
    }
    setError('');
    handleSubmit(groupMembers);
  };

  const updateMember = (i: number, patch: Partial<GroupMemberForm>) =>
    setGroupMembers(prev => prev.map((m, idx) => idx === i ? { ...m, ...patch } : m));

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
  // Registration open until midnight of the event day
  const midnightAfterEvent = new Date(event.starts_at);
  midnightAfterEvent.setHours(23, 59, 59, 999);
  const registrationOpen = now <= midnightAfterEvent;
  const spotsLeft = event.capacity ? event.capacity - registrationCount : null;
  const soldOut = spotsLeft !== null && spotsLeft <= 0;

  const hasTiers = tiers.length > 0;
  const isFreeEvent = !hasTiers && event.is_free;

  // Cheapest available tier price for the "from X" label
  const lowestAvailablePrice = hasTiers
    ? tiers.filter(t => tierAvailable(t, now).available).reduce((min, t) => Math.min(min, t.price), Infinity)
    : null;

  const priceLabel = hasTiers
    ? (lowestAvailablePrice === Infinity ? 'Sold out' : lowestAvailablePrice === 0 ? 'Free' : `from KES ${lowestAvailablePrice.toLocaleString()}`)
    : (isFreeEvent ? 'Free' : `KES ${(event.price ?? 0).toLocaleString()}`);

  const isBusy = submitting || stkPending;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-10 max-w-3xl">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-ui text-sm transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> All Events
        </button>

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
                <Badge variant={isFreeEvent ? 'secondary' : 'default'} className="shrink-0 mt-1">
                  {priceLabel}
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

            {/* Tier cards on the main body for discoverability */}
            {hasTiers && (
              <div>
                <h2 className="font-display text-lg text-foreground mb-3">Tickets</h2>
                <div className="space-y-2">
                  {tiers.map(tier => {
                    const { available, reason } = tierAvailable(tier, now);
                    const remaining = tier.capacity !== null ? tier.capacity - (tier.soldCount ?? 0) : null;
                    return (
                      <div key={tier.id} className={`rounded-[var(--radius-card)] border p-4 flex items-center gap-4 transition-colors ${available ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-ui font-medium text-foreground">{tier.name}</span>
                            <span className="font-ui text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tierLabel(tier)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs font-ui text-muted-foreground flex-wrap">
                            {tier.sale_ends_at && available && (
                              <span className="text-amber-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Ends {format(new Date(tier.sale_ends_at), 'd MMM, h:mm a')}
                              </span>
                            )}
                            {remaining !== null && available && (
                              <span>{remaining} left</span>
                            )}
                            {!available && reason && (
                              <span className="text-destructive">{reason}</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-display text-lg font-semibold text-foreground">
                            {tier.price === 0 ? 'Free' : `KES ${tier.price.toLocaleString()}`}
                          </p>
                          {tier.ticket_type === 'group' && tier.price > 0 && (
                            <p className="font-ui text-xs text-muted-foreground">
                              {`KES ${Math.round(tier.price / (tier.group_size ?? 1)).toLocaleString()} / person`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  <Button className="w-full font-ui rounded-full" variant="outline"
                    onClick={() => navigate(`/events/ticket/${ticketCode}`)}>
                    <Ticket className="mr-2 h-4 w-4" /> View Ticket
                  </Button>
                </div>
              ) : waitlisted ? (
                <div className="space-y-2 pt-2">
                  {!soldOut ? (
                    <>
                      <div className="flex items-center gap-2 text-emerald-600 text-sm font-ui">
                        <CheckCircle2 className="h-4 w-4" />
                        Spots are now available!
                      </div>
                      <p className="font-body text-xs text-muted-foreground">
                        You were on the waitlist but capacity has opened up. Register now to secure your spot.
                      </p>
                      <Button className="w-full font-ui rounded-full" onClick={() => { setWaitlisted(false); openDialog(); }}>
                        {hasTiers ? 'Get Tickets' : 'Register Now'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-amber-600 text-sm font-ui">
                        <Users className="h-4 w-4" />
                        You're on the waitlist
                      </div>
                      <p className="font-body text-xs text-muted-foreground">
                        We'll email you if a spot opens up and the organiser approves your entry.
                      </p>
                    </>
                  )}
                </div>
              ) : approvedWaitlist ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-ui">
                    <CheckCircle2 className="h-4 w-4" />
                    You've been approved!
                  </div>
                  <p className="font-body text-xs text-muted-foreground">
                    Your spot is reserved — complete payment to confirm.
                  </p>
                  <Button className="w-full font-ui rounded-full" onClick={() => {
                    setError('');
                    setPhone('');
                    setStkPending(false);
                    setStep('details');
                    setDialogOpen(true);
                  }}>
                    Complete Payment
                  </Button>
                </div>
              ) : pendingPayment ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-amber-600 text-sm font-ui">
                    <Smartphone className="h-4 w-4" />
                    Payment pending
                  </div>
                  <p className="font-body text-xs text-muted-foreground">
                    We sent an M-Pesa prompt to your phone. If it didn't arrive, you can resend it.
                  </p>
                  <Button className="w-full font-ui rounded-full" onClick={() => {
                    setRegistrationId(pendingPayment.registrationId);
                    setTransactionId(pendingPayment.transactionId);
                    setPollCount(0);
                    setStkPending(true);
                    setStep('stk-pending');
                    setDialogOpen(true);
                  }}>
                    Check payment status
                  </Button>
                </div>
              ) : registrationOpen && !soldOut ? (
                <Button className="w-full font-ui rounded-full" onClick={() => openDialog()}>
                  {isFreeEvent ? 'Register — Free' : hasTiers ? 'Get Tickets' : `Book — KES ${(event.price ?? 0).toLocaleString()}`}
                </Button>
              ) : registrationOpen && soldOut ? (
                <Button className="w-full font-ui rounded-full" variant="outline" onClick={() => openDialog(true)}>
                  Join Waitlist
                </Button>
              ) : !registrationOpen ? (
                <p className="text-sm font-ui text-muted-foreground text-center">Registration is closed.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Registration Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!isBusy) setDialogOpen(o); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {step === 'tier' ? 'Choose a ticket' :
               step === 'details' ? (isWaitlistJoin ? 'Join the waitlist' : selectedTier?.price === 0 || !selectedTier ? 'Register for event' : 'Your details') :
               step === 'group-members' ? (selectedTier?.ticket_type === 'group' ? 'Group members' : 'Other attendees') :
               'Check your phone'}
            </DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              {step === 'tier' ? event.title :
               step === 'stk-pending' ? 'Check your phone for the M-Pesa prompt.' :
               step === 'group-members'
                 ? (selectedTier?.ticket_type === 'group'
                     ? `Enter details for the other ${groupMembers.length} people in your group.`
                     : `Enter details for the other ${groupMembers.length} ${groupMembers.length === 1 ? 'attendee' : 'attendees'}.`)
               : isWaitlistJoin ? "You'll be notified by email if a spot opens up."
               : selectedTier?.price === 0 || !selectedTier
                 ? 'Secure your spot — a confirmation email will be sent to you.'
                 : 'Enter your details and pay via M-Pesa.'}
            </DialogDescription>
          </DialogHeader>

          {/* ── Step 1: Tier selection ── */}
          {step === 'tier' && (
            <div className="space-y-2 py-2">
              {tiers.map(tier => {
                const { available, reason } = tierAvailable(tier, now);
                const remaining = tier.capacity !== null ? tier.capacity - (tier.soldCount ?? 0) : null;
                return (
                  <button
                    key={tier.id}
                    disabled={!available}
                    onClick={() => handleTierSelect(tier)}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${available ? 'hover:border-primary hover:bg-primary/5 cursor-pointer border-border bg-card' : 'opacity-50 cursor-not-allowed border-border bg-muted/30'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-ui font-medium text-foreground">{tier.name}</span>
                          <span className="font-ui text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tierLabel(tier)}</span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-xs font-ui text-muted-foreground">
                          {tier.sale_ends_at && available && (
                            <p className="text-amber-600">Ends {format(new Date(tier.sale_ends_at), 'd MMM, h:mm a')}</p>
                          )}
                          {remaining !== null && available && <p>{remaining} spots left</p>}
                          {!available && reason && <p className="text-destructive">{reason}</p>}
                          {tier.ticket_type === 'group' && tier.price > 0 && (
                            <p>KES {Math.round(tier.price / (tier.group_size ?? 1)).toLocaleString()} / person</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-lg font-semibold text-foreground">
                          {tier.price === 0 ? 'Free' : `KES ${tier.price.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {error && (
                <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-3 mt-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="font-body text-xs">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Your details ── */}
          {step === 'details' && (
            <div className="space-y-4 py-2">
              {selectedTier && (
                <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3 font-ui text-sm">
                  <Tag className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{selectedTier.name}</span>
                    {selectedTier.ticket_type === 'group' && (
                      <span className="text-muted-foreground ml-2">· Group of {selectedTier.group_size}</span>
                    )}
                  </div>
                  <span className="font-display font-semibold text-foreground">
                    {selectedTier.price === 0 ? 'Free' : `KES ${selectedTier.price.toLocaleString()}`}
                  </span>
                </div>
              )}

              {/* Quantity picker — individual tiers only */}
              {selectedTier && selectedTier.ticket_type !== 'group' && !isWaitlistJoin && (() => {
                const remaining = selectedTier.capacity !== null
                  ? selectedTier.capacity - (selectedTier.soldCount ?? 0)
                  : null;
                const maxQty = remaining !== null ? Math.min(10, remaining) : 10;
                return (
                  <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
                    <span className="font-ui text-sm font-medium text-foreground">Tickets</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={quantity <= 1 || submitting}
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="h-8 w-8 rounded-full border border-input flex items-center justify-center text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-ui text-sm font-semibold w-5 text-center">{quantity}</span>
                      <button
                        type="button"
                        disabled={quantity >= maxQty || submitting}
                        onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                        className="h-8 w-8 rounded-full border border-input flex items-center justify-center text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {selectedTier && selectedTier.price > 0 && (
                <div className="bg-muted/40 rounded-xl p-4 flex justify-between items-center font-ui text-sm">
                  <span className="text-muted-foreground">Total to pay</span>
                  <div className="text-right">
                    <span className="font-display text-xl font-semibold">
                      KES {(selectedTier.price * (selectedTier.ticket_type === 'group' ? (selectedTier.group_size ?? 1) : quantity)).toLocaleString()}
                    </span>
                    {selectedTier.ticket_type !== 'group' && quantity > 1 && (
                      <p className="font-ui text-xs text-muted-foreground">KES {selectedTier.price.toLocaleString()} × {quantity} tickets</p>
                    )}
                    {selectedTier.ticket_type === 'group' && (selectedTier.group_size ?? 1) > 1 && (
                      <p className="font-ui text-xs text-muted-foreground">KES {Math.round(selectedTier.price / (selectedTier.group_size ?? 1)).toLocaleString()} × {selectedTier.group_size} people</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="font-ui text-sm font-medium text-foreground">Your Name</label>
                  <input type="text" placeholder="Your name" value={name}
                    onChange={e => { setName(e.target.value); setError(''); }}
                    disabled={submitting}
                    className="w-full font-ui text-sm border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-ui text-sm font-medium text-foreground">Your Email</label>
                  <input type="email" placeholder="you@example.com" value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    disabled={submitting}
                    className="w-full font-ui text-sm border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input transition-colors" />
                </div>
                {selectedTier && selectedTier.price > 0 && !isWaitlistJoin && (
                  <div className="space-y-1.5">
                    <label className="font-ui text-sm font-medium text-foreground">M-Pesa Number</label>
                    <input type="tel" placeholder="07XXXXXXXX" value={phone}
                      onChange={e => { setPhone(e.target.value); setError(''); }}
                      disabled={submitting}
                      className="w-full font-ui text-sm border rounded-lg px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input transition-colors" />
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

              <div className="flex gap-2">
                {tiers.length > 0 && !isWaitlistJoin && (
                  <Button variant="outline" className="font-ui rounded-full" onClick={() => { setStep('tier'); setError(''); }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <Button className="flex-1 font-ui rounded-full" onClick={handleDetailsNext} disabled={submitting}>
                  {submitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                    : isWaitlistJoin
                      ? 'Join Waitlist'
                      : (selectedTier?.ticket_type === 'group' || quantity > 1)
                        ? `Next — Add ${selectedTier?.ticket_type === 'group' ? 'Members' : 'Attendees'}`
                        : (!selectedTier || selectedTier.price === 0) ? 'Confirm Registration' : 'Send M-Pesa Prompt'}
                </Button>
              </div>

              <p className="font-body text-[11px] text-muted-foreground text-center">
                {(!selectedTier || selectedTier.price === 0)
                  ? 'A confirmation email with your ticket will be sent to the address above.'
                  : 'You\'ll receive a pop-up on your phone to enter your M-Pesa PIN.'}
              </p>
            </div>
          )}

          {/* ── Step 3: Group members ── */}
          {step === 'group-members' && (
            <div className="space-y-4 py-2">
              <p className="font-body text-xs text-muted-foreground">
                Each person gets their own ticket code and confirmation email. You've already filled in your details — now add the others.
              </p>

              {groupMembers.map((m, i) => (
                <div key={i} className="border rounded-xl p-3 space-y-2">
                  <p className="font-ui text-xs font-medium text-muted-foreground">Person {i + 2}</p>
                  <input type="text" placeholder="Full name" value={m.name}
                    onChange={e => { updateMember(i, { name: e.target.value }); setError(''); }}
                    className="w-full font-ui text-sm border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input transition-colors" />
                  <input type="email" placeholder="Email address" value={m.email}
                    onChange={e => { updateMember(i, { email: e.target.value }); setError(''); }}
                    className="w-full font-ui text-sm border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring border-input transition-colors" />
                </div>
              ))}

              {error && (
                <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="font-body text-xs">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="font-ui rounded-full" onClick={() => { setStep('details'); setError(''); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button className="flex-1 font-ui rounded-full" onClick={handleGroupMembersSubmit} disabled={submitting}>
                  {submitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                    : selectedTier && selectedTier.price > 0 ? 'Send M-Pesa Prompt' : 'Confirm Group Registration'}
                </Button>
              </div>
            </div>
          )}

          {/* ── STK pending ── */}
          {step === 'stk-pending' && (
            <div className="space-y-5 py-2">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center ${!stkPending && !stkSlowPoll ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                  <Smartphone className={`h-8 w-8 ${!stkPending && !stkSlowPoll ? 'text-amber-500' : 'text-primary animate-pulse'}`} />
                </div>
                <div className="text-center">
                  {!stkPending && !stkSlowPoll ? (
                    <>
                      <p className="font-ui font-medium text-foreground">Still waiting for M-Pesa</p>
                      <p className="font-body text-sm text-muted-foreground mt-1">
                        Your payment may still be processing. Close this and check{' '}
                        <button className="text-primary underline" onClick={() => { setDialogOpen(false); navigate('/dashboard'); }}>
                          your tickets
                        </button>{' '}
                        in a few minutes.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-ui font-medium text-foreground">Check your phone</p>
                      <p className="font-body text-sm text-muted-foreground mt-1">
                        Enter your M-Pesa PIN to pay{' '}
                        <strong>KES {(selectedTier ? selectedTier.price * (selectedTier.ticket_type === 'group' ? (selectedTier.group_size ?? 1) : quantity) : 0).toLocaleString()}</strong>.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {(stkPending || stkSlowPoll) && (
                <div className="flex items-center gap-2 bg-muted/40 rounded-xl p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <p className="font-body text-xs text-muted-foreground">
                    {stkSlowPoll
                      ? 'Still checking — this can take a couple of minutes…'
                      : `Waiting for confirmation… (${pollCount > 0 ? `${pollCount * 4}s` : 'just sent'})`}
                  </p>
                </div>
              )}

              <Button variant="outline" className="w-full font-ui rounded-full"
                onClick={() => { setStkPending(false); setStkSlowPoll(false); setStep('details'); setError(''); }}>
                {!stkPending && !stkSlowPoll ? 'Close' : 'Cancel'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetail;
