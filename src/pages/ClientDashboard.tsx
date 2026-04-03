import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, Video, Phone, MapPin, MessageSquare, X, Search, Link2, RefreshCw, Receipt, Star } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import ReviewDialog from '@/components/client/ReviewDialog';

interface SessionWithTherapist {
  id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string | null;
  session_format: string | null;
  session_type: string | null;
  price: number | null;
  currency: string | null;
  cancellation_reason: string | null;
  session_link: string | null;
  notes_therapist: string | null;
  therapist_id: string;
  therapist: {
    professional_title: string | null;
    photo_url: string | null;
    user_id: string;
  } | null;
  therapist_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  has_review?: boolean;
}

const formatIcon = (f: string | null) => {
  switch (f) {
    case 'video': return <Video className="h-4 w-4" />;
    case 'phone': return <Phone className="h-4 w-4" />;
    case 'in_person': return <MapPin className="h-4 w-4" />;
    case 'messaging': return <MessageSquare className="h-4 w-4" />;
    default: return <Video className="h-4 w-4" />;
  }
};

const formatLabel = (f: string | null) => {
  switch (f) {
    case 'video': return 'Video Call';
    case 'phone': return 'Phone Call';
    case 'in_person': return 'In-Person';
    case 'messaging': return 'Messaging';
    default: return 'Video Call';
  }
};

const statusBadge = (status: string | null) => {
  switch (status) {
    case 'confirmed':
      return <Badge className="bg-success/15 text-success border-success/20 font-ui">Confirmed</Badge>;
    case 'pending':
      return <Badge className="bg-warning/15 text-warning border-warning/20 font-ui">Pending</Badge>;
    case 'cancelled':
      return <Badge variant="destructive" className="font-ui">Cancelled</Badge>;
    case 'completed':
      return <Badge className="bg-secondary/15 text-secondary border-secondary/20 font-ui">Completed</Badge>;
    default:
      return <Badge variant="outline" className="font-ui">{status || 'Unknown'}</Badge>;
  }
};

const ClientDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithTherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [receiptSession, setReceiptSession] = useState<SessionWithTherapist | null>(null);

  const fetchSessions = async () => {
    if (!user) return;

    const { data: sessionData, error } = await supabase
      .from('sessions')
      .select(`
        id, scheduled_at, duration_minutes, status, session_format,
        session_type, price, currency, cancellation_reason, session_link, notes_therapist, therapist_id,
        therapist:therapists!sessions_therapist_id_fkey (
          professional_title, photo_url, user_id
        )
      `)
      .eq('client_id', user.id)
      .order('scheduled_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      setLoading(false);
      return;
    }

    // Get existing reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select('session_id')
      .eq('client_id', user.id);
    const reviewedSessionIds = new Set((reviews ?? []).map((r) => r.session_id));

    const enriched: SessionWithTherapist[] = [];
    for (const s of sessionData || []) {
      let therapist_profile = null;
      const therapist = Array.isArray(s.therapist) ? s.therapist[0] : s.therapist;
      if (therapist?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', therapist.user_id)
          .maybeSingle();
        therapist_profile = profile;
      }
      enriched.push({
        ...s,
        therapist,
        therapist_profile,
        has_review: reviewedSessionIds.has(s.id),
      });
    }

    setSessions(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const handleCancel = async (sessionId: string) => {
    setCancellingId(sessionId);
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'cancelled', cancellation_reason: cancelReason || 'Cancelled by client' })
      .eq('id', sessionId)
      .eq('client_id', user!.id);

    if (error) {
      toast({ title: 'Error', description: 'Could not cancel session. Please try again.', variant: 'destructive' });
    } else {
      toast({ title: 'Session cancelled', description: 'Your session has been cancelled successfully.' });
      fetchSessions();
    }
    setCancelReason('');
    setCancellingId(null);
  };

  const upcomingSessions = sessions.filter(
    (s) => !isPast(new Date(s.scheduled_at)) && s.status !== 'cancelled' && s.status !== 'completed'
  );
  const pastSessions = sessions.filter(
    (s) => isPast(new Date(s.scheduled_at)) || s.status === 'cancelled' || s.status === 'completed'
  );
  const nextSession = upcomingSessions[upcomingSessions.length - 1];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-10">
        <div>
          <h1 className="font-display text-3xl text-foreground mb-1">
            Welcome back{user?.user_metadata?.first_name ? `, ${user.user_metadata.first_name}` : ''}
          </h1>
          <p className="font-body text-muted-foreground">Your journey continues. Here's what's happening.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-card rounded-[var(--radius)] p-5 shadow-[var(--shadow-card)] border border-border">
            <p className="font-ui text-xs text-muted-foreground uppercase tracking-wide mb-1">Upcoming</p>
            <p className="font-display text-3xl text-foreground">{upcomingSessions.length}</p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {upcomingSessions.length === 0 ? 'No sessions scheduled' : 'session(s) ahead'}
            </p>
          </div>
          <div className="bg-card rounded-[var(--radius)] p-5 shadow-[var(--shadow-card)] border border-border">
            <p className="font-ui text-xs text-muted-foreground uppercase tracking-wide mb-1">Completed</p>
            <p className="font-display text-3xl text-foreground">
              {sessions.filter((s) => s.status === 'completed').length}
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1">sessions so far</p>
          </div>
          <div className="bg-card rounded-[var(--radius)] p-5 shadow-[var(--shadow-card)] border border-border">
            <p className="font-ui text-xs text-muted-foreground uppercase tracking-wide mb-1">Next Session</p>
            <p className="font-display text-lg text-foreground">
              {nextSession ? (isToday(new Date(nextSession.scheduled_at)) ? 'Today' : format(new Date(nextSession.scheduled_at), 'MMM d')) : '—'}
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {nextSession ? format(new Date(nextSession.scheduled_at), 'h:mm a') : 'Nothing scheduled'}
            </p>
          </div>
        </div>

        {/* Upcoming */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl text-foreground">Upcoming Sessions</h2>
            <Link to="/matches">
              <Button variant="outline" size="sm" className="font-ui gap-2"><Search className="h-4 w-4" /> Find Therapist</Button>
            </Link>
          </div>
          {upcomingSessions.length === 0 ? (
            <div className="bg-card rounded-[var(--radius)] p-8 border border-border text-center">
              <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-display text-lg text-foreground mb-1">No upcoming sessions</p>
              <p className="font-body text-sm text-muted-foreground mb-4">Browse therapists and book your first session.</p>
              <Link to="/matches"><Button className="font-ui">Browse Therapists</Button></Link>
            </div>
          ) : (
            <div className="space-y-4">
              {[...upcomingSessions].reverse().map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onCancel={handleCancel}
                  cancelReason={cancelReason}
                  setCancelReason={setCancelReason}
                  isCancelling={cancellingId === session.id}
                  showCancel
                />
              ))}
            </div>
          )}
        </section>

        {/* Past */}
        {pastSessions.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-foreground mb-5">Past Sessions</h2>
            <div className="space-y-3">
              {pastSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRebook={() => navigate(`/book/${session.therapist_id}`)}
                  onViewReceipt={() => setReceiptSession(session)}
                  onReviewSubmitted={fetchSessions}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Receipt Dialog */}
      <Dialog open={!!receiptSession} onOpenChange={() => setReceiptSession(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Session Receipt</DialogTitle>
          </DialogHeader>
          {receiptSession && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 font-ui text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-foreground">{format(new Date(receiptSession.scheduled_at), 'MMMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="text-foreground">{format(new Date(receiptSession.scheduled_at), 'h:mm a')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="text-foreground">{receiptSession.duration_minutes || 50} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format</span>
                  <span className="text-foreground">{formatLabel(receiptSession.session_format)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Therapist</span>
                  <span className="text-foreground">
                    {receiptSession.therapist_profile
                      ? `${receiptSession.therapist_profile.first_name || ''} ${receiptSession.therapist_profile.last_name || ''}`.trim()
                      : 'Therapist'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-foreground capitalize">{receiptSession.status}</span>
                </div>
              </div>
              {receiptSession.price && (
                <div className="bg-card border border-border rounded-lg p-4 flex justify-between items-center">
                  <span className="font-ui text-sm text-muted-foreground">Amount</span>
                  <span className="font-display text-xl text-foreground">
                    {receiptSession.currency || 'KES'} {receiptSession.price.toLocaleString()}
                  </span>
                </div>
              )}
              {receiptSession.notes_therapist && (
                <div className="space-y-1">
                  <p className="font-ui text-xs text-muted-foreground uppercase tracking-wide">Therapist Notes</p>
                  <p className="font-body text-sm text-foreground bg-muted/50 rounded-lg p-3">{receiptSession.notes_therapist}</p>
                </div>
              )}
              <p className="font-ui text-[10px] text-muted-foreground text-center">
                Session ID: {receiptSession.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface SessionCardProps {
  session: SessionWithTherapist;
  onCancel?: (id: string) => Promise<void>;
  cancelReason?: string;
  setCancelReason?: (v: string) => void;
  isCancelling?: boolean;
  showCancel?: boolean;
  onRebook?: () => void;
  onViewReceipt?: () => void;
  onReviewSubmitted?: () => void;
}

const SessionCard = ({
  session, onCancel, cancelReason = '', setCancelReason,
  isCancelling, showCancel, onRebook, onViewReceipt, onReviewSubmitted,
}: SessionCardProps) => {
  const therapistName = session.therapist_profile
    ? `${session.therapist_profile.first_name || ''} ${session.therapist_profile.last_name || ''}`.trim()
    : 'Your Therapist';

  const date = new Date(session.scheduled_at);
  const isPastSession = isPast(date) || session.status === 'cancelled' || session.status === 'completed';

  return (
    <div className={`bg-card rounded-[var(--radius)] p-5 border border-border shadow-[var(--shadow-card)] transition-all ${isPastSession ? 'opacity-75' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-base text-foreground">{therapistName}</h3>
            {statusBadge(session.status)}
          </div>
          <p className="font-body text-sm text-muted-foreground">{session.therapist?.professional_title || 'Therapist'}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-ui">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {isToday(date) ? 'Today' : format(date, 'EEE, MMM d, yyyy')}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {format(date, 'h:mm a')} · {session.duration_minutes || 50}min
            </span>
            <span className="flex items-center gap-1.5">
              {formatIcon(session.session_format)}
              {formatLabel(session.session_format)}
            </span>
          </div>
          {session.price && (
            <p className="font-ui text-xs text-muted-foreground">{session.currency || 'KES'} {session.price?.toLocaleString()}</p>
          )}
          {session.status === 'confirmed' && session.session_link && (
            <a href={session.session_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-ui text-xs text-primary hover:underline mt-1">
              <Link2 className="h-3.5 w-3.5" /> Join Session
            </a>
          )}
          {session.status === 'cancelled' && session.cancellation_reason && (
            <p className="font-body text-xs text-destructive italic">Reason: {session.cancellation_reason}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {/* Past session actions */}
          {isPastSession && session.status === 'completed' && !session.has_review && (
            <ReviewDialog
              sessionId={session.id}
              therapistId={session.therapist_id}
              therapistName={therapistName}
              onReviewSubmitted={onReviewSubmitted}
            />
          )}
          {isPastSession && session.status === 'completed' && session.has_review && (
            <Badge variant="outline" className="font-ui text-xs gap-1"><Star className="h-3 w-3 fill-warning text-warning" /> Reviewed</Badge>
          )}
          {isPastSession && onViewReceipt && session.status !== 'cancelled' && (
            <Button variant="ghost" size="sm" onClick={onViewReceipt} className="font-ui text-xs rounded-full gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Receipt
            </Button>
          )}
          {isPastSession && onRebook && session.status !== 'cancelled' && (
            <Button variant="outline" size="sm" onClick={onRebook} className="font-ui text-xs rounded-full gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Book Again
            </Button>
          )}

          {/* Cancel action */}
          {showCancel && session.status !== 'cancelled' && onCancel && setCancelReason && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="font-ui text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 shrink-0">
                  <X className="h-4 w-4" /> Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display">Cancel this session?</AlertDialogTitle>
                  <AlertDialogDescription className="font-body">
                    This will cancel your session with {therapistName} on {format(date, 'MMMM d')} at {format(date, 'h:mm a')}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="Reason for cancellation (optional)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="font-ui"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-ui">Keep Session</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onCancel(session.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-ui"
                    disabled={isCancelling}
                  >
                    {isCancelling ? 'Cancelling...' : 'Yes, Cancel Session'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
