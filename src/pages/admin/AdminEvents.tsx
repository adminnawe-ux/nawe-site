import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Calendar, MapPin, Trash2, ExternalLink, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { usePlacesAutocomplete } from '@/hooks/usePlacesAutocomplete';

interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  location_url: string | null;
  status: string;
  is_free: boolean;
  price: number | null;
  currency: string;
}

type FormData = {
  title: string; slug: string; description: string;
  starts_at: string; ends_at: string;
  location: string; location_url: string;
  is_free: boolean; price: string; status: string;
};

const EMPTY_FORM: FormData = {
  title: '', slug: '', description: '', starts_at: '', ends_at: '',
  location: '', location_url: '', is_free: true, price: '', status: 'draft',
};

function toLocalDatetimeValue(iso: string | null) {
  if (!iso) return '';
  // Strip seconds/ms so datetime-local input renders correctly
  return iso.slice(0, 16);
}

function eventToForm(e: Event): FormData {
  return {
    title: e.title,
    slug: e.slug,
    description: e.description ?? '',
    starts_at: toLocalDatetimeValue(e.starts_at),
    ends_at: toLocalDatetimeValue(e.ends_at),
    location: e.location ?? '',
    location_url: e.location_url ?? '',
    is_free: e.is_free,
    price: e.price != null ? String(e.price) : '',
    status: e.status,
  };
}

const AdminEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const createLocationRef = useRef<HTMLInputElement>(null);
  const editLocationRef = useRef<HTMLInputElement>(null);

  const handlePlaceSelectCreate = useCallback(({ name, mapsUrl }: { name: string; mapsUrl: string }) => {
    setFormData((prev) => ({ ...prev, location: name, location_url: mapsUrl }));
  }, []);
  const handlePlaceSelectEdit = useCallback(({ name, mapsUrl }: { name: string; mapsUrl: string }) => {
    setFormData((prev) => ({ ...prev, location: name, location_url: mapsUrl }));
  }, []);

  usePlacesAutocomplete(createLocationRef, handlePlaceSelectCreate);
  usePlacesAutocomplete(editLocationRef, handlePlaceSelectEdit);

  useEffect(() => {
    supabase
      .from('events')
      .select('id, slug, title, description, starts_at, ends_at, location, location_url, status, is_free, price, currency')
      .order('starts_at', { ascending: false })
      .then(({ data }) => { setEvents(data ?? []); setLoading(false); });
  }, []);

  const buildPayload = (f: FormData) => ({
    title: f.title,
    slug: f.slug,
    description: f.description || null,
    starts_at: new Date(f.starts_at).toISOString(),
    ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    location: f.location || null,
    location_url: f.location_url || null,
    is_free: f.is_free,
    price: f.is_free ? null : (parseFloat(f.price) || 0),
    currency: 'KES',
    status: f.status,
  });

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.slug.trim() || !formData.starts_at) return;
    setSaving(true); setError('');
    const { data: newEvent, error: err } = await supabase
      .from('events').insert(buildPayload(formData)).select().single();
    if (err) { setError(err.message.includes('unique') ? 'Slug already exists — choose a different one.' : err.message); setSaving(false); return; }
    if (newEvent) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-event-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ event_id: newEvent.id, title: formData.title, location: formData.location || null, starts_at: new Date(formData.starts_at).toISOString(), ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null }),
        });
      } catch (e) { console.error('Calendar creation failed:', e); }
      setEvents([newEvent as Event, ...events]);
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editEvent || !formData.title.trim() || !formData.starts_at) return;
    setSaving(true); setError('');
    const { data: updated, error: err } = await supabase
      .from('events').update(buildPayload(formData)).eq('id', editEvent.id).select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    if (updated) {
      setEvents(events.map(e => e.id === editEvent.id ? updated as Event : e));
      setEditEvent(null);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this event? This cannot be undone.')) {
      await supabase.from('events').delete().eq('id', id);
      setEvents(events.filter(e => e.id !== id));
    }
  };

  const openEdit = (event: Event) => {
    setFormData(eventToForm(event));
    setError('');
    setEditEvent(event);
  };

  const EventForm = ({ locationRef, onSubmit, submitLabel }: {
    locationRef: React.RefObject<HTMLInputElement>;
    onSubmit: () => void;
    submitLabel: string;
  }) => (
    <div className="space-y-4 py-2">
      {error && <p className="text-sm text-destructive font-ui">{error}</p>}
      <input type="text" placeholder="Title *" value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
      <input type="text" placeholder="Slug * (e.g. mental-health-talk-june)" value={formData.slug}
        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
        className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
      <textarea placeholder="Description" value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        className="w-full px-3 py-2 border rounded-lg text-sm font-ui" rows={3} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-ui text-xs text-muted-foreground mb-1">Start *</label>
          <input type="datetime-local" value={formData.starts_at}
            onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
        </div>
        <div>
          <label className="block font-ui text-xs text-muted-foreground mb-1">End</label>
          <input type="datetime-local" value={formData.ends_at}
            onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
        </div>
      </div>
      <div>
        <label className="block font-ui text-xs text-muted-foreground mb-1">Location (search Google Maps)</label>
        <input ref={locationRef} type="text" placeholder="Search for a venue or address..."
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value, location_url: '' })}
          className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
        {formData.location_url && (
          <a href={formData.location_url} target="_blank" rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1 font-ui text-xs text-primary hover:underline">
            <MapPin className="h-3 w-3" /> View on Google Maps <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
      <label className="flex items-center gap-2 font-ui text-sm cursor-pointer">
        <input type="checkbox" checked={formData.is_free}
          onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })} />
        Free event
      </label>
      {!formData.is_free && (
        <input type="number" placeholder="Price (KES)" value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
      )}
      <select value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        className="w-full px-3 py-2 border rounded-lg text-sm font-ui">
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="cancelled">Cancelled</option>
        <option value="completed">Completed</option>
      </select>
      <Button onClick={onSubmit} disabled={saving} className="w-full font-ui rounded-full">
        {saving ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">Events</h1>
        <Button onClick={() => { setFormData(EMPTY_FORM); setError(''); setCreateOpen(true); }} className="font-ui rounded-full">
          <Plus className="mr-2 h-4 w-4" /> New Event
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">No events yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="font-ui font-medium text-foreground truncate">{event.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-ui">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(event.starts_at), 'd MMM yyyy, h:mm a')}</span>
                  {event.location && (
                    event.location_url ? (
                      <a href={event.location_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors">
                        <MapPin className="h-3 w-3" /> {event.location} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location}</span>
                    )
                  )}
                  <span className={`px-2 py-0.5 rounded ${event.status === 'published' ? 'bg-success/10 text-success' : event.status === 'cancelled' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{event.status}</span>
                  <span>{event.is_free ? 'Free' : `${event.currency} ${event.price?.toLocaleString()}`}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(event)} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(event.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
          <EventForm locationRef={createLocationRef} onSubmit={handleCreate} submitLabel="Create Event" />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editEvent} onOpenChange={(open) => { if (!open) setEditEvent(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
          <EventForm locationRef={editLocationRef} onSubmit={handleEdit} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEvents;
