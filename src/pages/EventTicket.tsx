import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Calendar, Clock, MapPin, ArrowLeft, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';

interface TicketData {
  ticket_code: string;
  attendee_name: string;
  attendee_email: string;
  payment_status: string;
  event: {
    title: string;
    poster_url: string | null;
    organizer_name: string | null;
    location: string | null;
    location_url: string | null;
    starts_at: string;
    ends_at: string | null;
    is_free: boolean;
    price: number | null;
    currency: string;
    slug: string;
  };
}

const EventTicket = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    supabase.functions.invoke('get-event-ticket', { body: { ticket_code: code } })
      .then(({ data, error }) => {
        if (!error && data?.ticket) setTicket(data.ticket);
        setLoading(false);
      });
  }, [code]);

  const handleAddToCalendar = () => {
    if (!ticket) return;
    const { event } = ticket;
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `Your ticket code: ${ticket.ticket_code}`,
      location: event.location ?? '',
    });
    window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm px-6 space-y-4">
          <Skeleton className="h-8 w-2/3 mx-auto" />
          <Skeleton className="h-48 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <h2 className="font-display text-2xl text-foreground mb-2">Ticket not found</h2>
          <p className="font-body text-muted-foreground mb-6">This ticket code is invalid or has been cancelled.</p>
          <Button variant="outline" onClick={() => navigate('/events')} className="font-ui rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const { event } = ticket;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h1 className="font-display text-2xl text-foreground">You're registered!</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Show this ticket at the event entrance.
          </p>
        </div>

        {/* Ticket card */}
        <div className="rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
          {event.poster_url && (
            <img src={event.poster_url} alt={event.title} className="w-full h-36 object-cover" />
          )}

          <div className="p-5 space-y-4">
            <div>
              <h2 className="font-display text-xl text-foreground leading-tight">{event.title}</h2>
              {event.organizer_name && (
                <p className="font-body text-xs text-muted-foreground mt-1">By {event.organizer_name}</p>
              )}
            </div>

            <div className="space-y-2 text-sm font-ui">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                {format(new Date(event.starts_at), 'EEEE, d MMMM yyyy')}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                {format(new Date(event.starts_at), 'h:mm a')}
                {event.ends_at && ` – ${format(new Date(event.ends_at), 'h:mm a')}`}
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  {event.location_url
                    ? <a href={event.location_url} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">{event.location}</a>
                    : event.location
                  }
                </div>
              )}
            </div>

            {/* Divider with ticket holes */}
            <div className="flex items-center gap-0 -mx-5">
              <div className="h-5 w-5 rounded-full bg-background border border-border -ml-2.5 shrink-0" />
              <div className="flex-1 border-t-2 border-dashed border-border" />
              <div className="h-5 w-5 rounded-full bg-background border border-border -mr-2.5 shrink-0" />
            </div>

            {/* Ticket code */}
            <div className="text-center space-y-1">
              <p className="font-ui text-xs text-muted-foreground uppercase tracking-wide">Ticket Code</p>
              <p className="font-display text-3xl tracking-widest text-foreground">{ticket.ticket_code}</p>
              <p className="font-body text-xs text-muted-foreground">{ticket.attendee_name}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 space-y-3">
          <Button
            className="w-full font-ui rounded-full"
            variant="outline"
            onClick={handleAddToCalendar}
          >
            <CalendarPlus className="mr-2 h-4 w-4" /> Add to Google Calendar
          </Button>
          <Link to={`/events/${event.slug}`} className="block">
            <Button className="w-full font-ui rounded-full" variant="ghost">
              Back to Event
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EventTicket;
