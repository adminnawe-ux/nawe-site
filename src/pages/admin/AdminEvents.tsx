import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, MapPin, Trash2, ExternalLink, Pencil, Users, CheckCircle2, Circle, Mail, Ticket, Search, Upload, X, ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { usePlacesAutocomplete } from '@/hooks/usePlacesAutocomplete';

// Cast to any — events/event_registrations tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Registration {
  id: string;
  attendee_name: string;
  attendee_email: string;
  ticket_code: string;
  payment_status: string;
  price_paid: number | null;
  checked_in: boolean;
  created_at: string;
}

interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  location_url: string | null;
  poster_url: string | null;
  status: string;
  is_free: boolean;
  price: number | null;
  currency: string;
}

type FormData = {
  title: string; slug: string; description: string;
  starts_at: string; ends_at: string;
  location: string; location_url: string;
  poster_url: string;
  is_free: boolean; price: string; status: string;
};

const EMPTY_FORM: FormData = {
  title: '', slug: '', description: '', starts_at: '', ends_at: '',
  location: '', location_url: '', poster_url: '', is_free: true, price: '', status: 'draft',
};

function toLocalDatetimeValue(iso: string | null) {
  if (!iso) return '';
  return iso.slice(0, 16);
}

function eventToForm(e: Event): FormData {
  return {
    title: e.title, slug: e.slug, description: e.description ?? '',
    starts_at: toLocalDatetimeValue(e.starts_at), ends_at: toLocalDatetimeValue(e.ends_at),
    location: e.location ?? '', location_url: e.location_url ?? '',
    poster_url: e.poster_url ?? '',
    is_free: e.is_free, price: e.price != null ? String(e.price) : '', status: e.status,
  };
}

// Module-level component — must NOT be defined inside AdminEvents to prevent
// remount on every keystroke (which causes cursor loss and focus reset).
interface EventFormProps {
  formData: FormData;
  setFormData: (f: FormData) => void;
  locationRef: React.RefObject<HTMLInputElement>;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
  error: string;
}

const EventForm = ({ formData, setFormData, locationRef, onSubmit, submitLabel, saving, error }: EventFormProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `posters/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('event-posters').upload(path, file, { upsert: true });
    if (uploadErr) { alert(`Upload failed: ${uploadErr.message}`); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('event-posters').getPublicUrl(path);
    setFormData({ ...formData, poster_url: publicUrl });
    setUploading(false);
  };

  return (
    <div className="space-y-4 py-2">
      {error && <p className="text-sm text-destructive font-ui">{error}</p>}

      {/* Poster upload */}
      <div>
        <label className="block font-ui text-xs text-muted-foreground mb-1">Event Poster</label>
        <div className="flex gap-3 items-start">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden"
          >
            {formData.poster_url ? (
              <img src={formData.poster_url} alt="Poster" className="w-full h-full object-cover" />
            ) : uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <>
                <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="font-ui text-xs text-muted-foreground">Upload</span>
              </>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
              disabled={uploading} className="font-ui text-xs gap-1.5">
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Choose image'}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePosterUpload} />
            <input type="text" placeholder="Or paste image URL"
              value={formData.poster_url}
              onChange={(e) => setFormData({ ...formData, poster_url: e.target.value })}
              className="w-full px-3 py-1.5 border rounded-lg text-xs font-ui" />
            {formData.poster_url && (
              <button type="button" onClick={() => setFormData({ ...formData, poster_url: '' })}
                className="flex items-center gap-1 font-ui text-xs text-destructive hover:underline">
                <X className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
        </div>
        <p className="font-ui text-xs text-muted-foreground mt-1">JPG, PNG or WebP · max 5 MB</p>
      </div>

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
      <Button onClick={onSubmit} disabled={saving || uploading} className="w-full font-ui rounded-full">
        {saving ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
};

const AdminEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attendeesEvent, setAttendeesEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const createLocationRef = useRef<HTMLInputElement>(null);
  const editLocationRef = useRef<HTMLInputElement>(null);

  const handlePlaceSelectCreate = useCallback(({ name, mapsUrl }: { name: string; mapsUrl: string }) => {
    setFormData((prev) => ({ ...prev, location: name, location_url: mapsUrl }));
  }, []);
  const handlePlaceSelectEdit = useCallback(({ name, mapsUrl }: { name: string; mapsUrl: string }) => {
    setFormData((prev) => ({ ...prev, location: name, location_url: mapsUrl }));
  }, []);

  // Pass enabled=true only when the respective dialog is open so the autocomplete
  // re-attaches each time (the input is remounted when the dialog opens).
  usePlacesAutocomplete(createLocationRef, handlePlaceSelectCreate, createOpen);
  usePlacesAutocomplete(editLocationRef, handlePlaceSelectEdit, !!editEvent);

  useEffect(() => {
    db.from('events')
      .select('id, slug, title, description, starts_at, ends_at, location, location_url, poster_url, status, is_free, price, currency')
      .order('starts_at', { ascending: false })
      .then(({ data }: { data: Event[] }) => { setEvents(data ?? []); setLoading(false); });
  }, []);

  const buildPayload = (f: FormData) => ({
    title: f.title, slug: f.slug, description: f.description || null,
    starts_at: new Date(f.starts_at).toISOString(),
    ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    location: f.location || null, location_url: f.location_url || null,
    poster_url: f.poster_url || null,
    is_free: f.is_free, price: f.is_free ? null : (parseFloat(f.price) || 0),
    currency: 'KES', status: f.status,
  });

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.slug.trim() || !formData.starts_at) return;
    setSaving(true); setError('');
    const { data: newEvent, error: err } = await db.from('events').insert(buildPayload(formData)).select().single();
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
      setEvents((prev) => [newEvent as Event, ...prev]);
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editEvent || !formData.title.trim() || !formData.starts_at) return;
    setSaving(true); setError('');
    const { data: updated, error: err } = await db.from('events').update(buildPayload(formData)).eq('id', editEvent.id).select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    if (updated) {
      setEvents((prev) => prev.map(e => e.id === editEvent.id ? updated as Event : e));
      setEditEvent(null);
    }
    setSaving(false);
  };

  const openAttendees = async (event: Event) => {
    setAttendeesEvent(event);
    setAttendeeSearch('');
    setRegsLoading(true);
    const { data } = await db.from('event_registrations')
      .select('id, attendee_name, attendee_email, ticket_code, payment_status, price_paid, checked_in, created_at')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true });
    setRegistrations(data ?? []);
    setRegsLoading(false);
  };

  const toggleCheckIn = async (reg: Registration) => {
    const { data } = await db.from('event_registrations')
      .update({ checked_in: !reg.checked_in })
      .eq('id', reg.id)
      .select('id, checked_in')
      .single();
    if (data) setRegistrations((prev) => prev.map((r) => r.id === reg.id ? { ...r, checked_in: data.checked_in } : r));
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this event? This cannot be undone.')) {
      await db.from('events').delete().eq('id', id);
      setEvents((prev) => prev.filter(e => e.id !== id));
    }
  };

  const openEdit = (event: Event) => {
    setFormData(eventToForm(event));
    setError('');
    setEditEvent(event);
  };

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
              {event.poster_url ? (
                <img src={event.poster_url} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="font-ui font-medium text-foreground truncate">{event.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-ui">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(event.starts_at), 'd MMM yyyy, h:mm a')}</span>
                  {event.location && (
                    event.location_url
                      ? <a href={event.location_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors"><MapPin className="h-3 w-3" /> {event.location} <ExternalLink className="h-2.5 w-2.5" /></a>
                      : <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded ${event.status === 'published' ? 'bg-success/10 text-success' : event.status === 'cancelled' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{event.status}</span>
                  <span>{event.is_free ? 'Free' : `${event.currency} ${event.price?.toLocaleString()}`}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openAttendees(event)} className="text-muted-foreground hover:text-foreground gap-1.5 font-ui text-xs">
                  <Users className="h-4 w-4" /> Attendees
                </Button>
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
          <EventForm formData={formData} setFormData={setFormData} locationRef={createLocationRef}
            onSubmit={handleCreate} submitLabel="Create Event" saving={saving} error={error} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editEvent} onOpenChange={(open) => { if (!open) setEditEvent(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
          <EventForm formData={formData} setFormData={setFormData} locationRef={editLocationRef}
            onSubmit={handleEdit} submitLabel="Save Changes" saving={saving} error={error} />
        </DialogContent>
      </Dialog>

      {/* Attendees sheet */}
      <Sheet open={!!attendeesEvent} onOpenChange={(open) => { if (!open) setAttendeesEvent(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display text-lg">{attendeesEvent?.title}</SheetTitle>
            {!regsLoading && (
              <div className="flex gap-4 text-xs font-ui text-muted-foreground pt-1">
                <span>{registrations.length} registered</span>
                <span>{registrations.filter(r => r.checked_in).length} checked in</span>
                {!attendeesEvent?.is_free && (
                  <span>KES {registrations.filter(r => r.payment_status === 'paid').reduce((s, r) => s + (r.price_paid ?? 0), 0).toLocaleString()} collected</span>
                )}
              </div>
            )}
          </SheetHeader>

          {!regsLoading && registrations.length > 0 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input type="text" placeholder="Search by name or ticket #..."
                value={attendeeSearch} onChange={(e) => setAttendeeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm font-ui bg-background"
                autoFocus />
            </div>
          )}

          {(() => {
            if (regsLoading) return (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            );
            if (registrations.length === 0) return (
              <div className="text-center py-16 text-muted-foreground font-body">No registrations yet.</div>
            );
            const q = attendeeSearch.toLowerCase().trim();
            const filtered = q
              ? registrations.filter(r => r.attendee_name.toLowerCase().includes(q) || r.ticket_code.toLowerCase().includes(q))
              : registrations;
            if (filtered.length === 0) return (
              <p className="text-center py-8 text-muted-foreground font-ui text-sm">No match for "{attendeeSearch}"</p>
            );
            return (
              <div className="space-y-2">
                {filtered.map((reg) => {
                  const isPaid = reg.payment_status === 'paid' || reg.payment_status === 'free';
                  return (
                    <div key={reg.id} className={`rounded-lg border p-3 flex items-center gap-3 transition-colors ${reg.checked_in ? 'border-success/30 bg-success/5' : 'border-border bg-card'}`}>
                      <button onClick={() => toggleCheckIn(reg)} className="shrink-0" title={reg.checked_in ? 'Mark not checked in' : 'Check in'}>
                        {reg.checked_in
                          ? <CheckCircle2 className="h-5 w-5 text-success" />
                          : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-ui text-sm font-medium text-foreground truncate">{reg.attendee_name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 font-ui text-xs text-muted-foreground"><Mail className="h-3 w-3" />{reg.attendee_email}</span>
                          <span className="flex items-center gap-1 font-ui text-xs text-muted-foreground"><Ticket className="h-3 w-3" />{reg.ticket_code}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {attendeesEvent?.is_free ? (
                          <Badge variant="outline" className="font-ui text-xs">Free</Badge>
                        ) : (
                          <>
                            <Badge className={`font-ui text-xs ${isPaid ? 'bg-success/10 text-success border-success/20' : reg.payment_status === 'pending_stk' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                              {reg.payment_status === 'paid' ? 'Paid' : reg.payment_status === 'pending_stk' ? 'Pending' : reg.payment_status === 'free' ? 'Free' : 'Failed'}
                            </Badge>
                            {reg.price_paid != null && reg.payment_status === 'paid' && (
                              <span className="font-ui text-xs text-muted-foreground">KES {reg.price_paid.toLocaleString()}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminEvents;
