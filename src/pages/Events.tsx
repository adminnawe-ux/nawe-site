import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, MapPin, Clock, Users } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';

interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  organizer_name: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  is_free: boolean;
  price: number | null;
  currency: string;
  capacity: number | null;
  status: string;
}

const EventCard = ({ event }: { event: Event }) => {
  const upcoming = isFuture(new Date(event.starts_at));

  return (
    <Link to={`/events/${event.slug}`} className="group block">
      <div className="rounded-[var(--radius-card)] border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-md transition-shadow">
        {event.poster_url ? (
          <div className="aspect-[16/9] overflow-hidden bg-muted">
            <img
              src={event.poster_url}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-primary/10 flex items-center justify-center">
            <Calendar className="h-12 w-12 text-primary/30" />
          </div>
        )}

        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {event.title}
            </h3>
            <Badge
              variant={event.is_free ? 'secondary' : 'default'}
              className="shrink-0 text-xs"
            >
              {event.is_free ? 'Free' : `${event.currency} ${(event.price ?? 0).toLocaleString()}`}
            </Badge>
          </div>

          {event.organizer_name && (
            <p className="font-body text-xs text-muted-foreground">
              Hosted by {event.organizer_name}
            </p>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-ui">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{format(new Date(event.starts_at), 'EEE d MMM yyyy')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-ui">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {format(new Date(event.starts_at), 'h:mm a')}
                {event.ends_at && ` – ${format(new Date(event.ends_at), 'h:mm a')}`}
              </span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-ui">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>

          <div className="pt-1">
            {upcoming ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-ui text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
                Upcoming
              </span>
            ) : (
              <span className="text-xs font-ui text-muted-foreground">Past event</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  useEffect(() => {
    supabase
      .from('events')
      .select('id, slug, title, description, poster_url, organizer_name, location, starts_at, ends_at, is_free, price, currency, capacity, status')
      .eq('status', 'published')
      .order('starts_at', { ascending: true })
      .then(({ data }) => {
        setEvents(data ?? []);
        setLoading(false);
      });
  }, []);

  const now = new Date();
  const filtered = events.filter((e) => {
    if (filter === 'upcoming') return isFuture(new Date(e.starts_at));
    if (filter === 'past') return isPast(new Date(e.starts_at));
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="mb-10">
          <h1 className="font-display text-4xl text-foreground mb-3">Events</h1>
          <p className="font-body text-muted-foreground text-lg">
            Workshops, meetups, and community gatherings hosted by Nawe.
          </p>
        </div>

        <div className="flex gap-2 mb-8">
          {(['upcoming', 'past', 'all'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className="font-ui rounded-full capitalize"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[var(--radius-card)] border border-border overflow-hidden">
                <Skeleton className="aspect-[16/9] w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-display text-xl text-foreground mb-2">
              {filter === 'upcoming' ? 'No upcoming events' : 'No events found'}
            </p>
            <p className="font-body text-muted-foreground">Check back soon for new events.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Events;
