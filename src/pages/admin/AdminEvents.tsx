import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Calendar, MapPin, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Event {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  location: string | null;
  status: string;
  is_free: boolean;
  price: number | null;
  currency: string;
}

const AdminEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', slug: '', description: '', starts_at: '', ends_at: '', location: '', is_free: true, price: '', status: 'draft' });

  useEffect(() => {
    supabase
      .from('events')
      .select('id, slug, title, starts_at, location, status, is_free, price, currency')
      .order('starts_at', { ascending: false })
      .then(({ data }) => {
        setEvents(data ?? []);
        setLoading(false);
      });
  }, []);

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.slug.trim()) return;

    const { data: newEvent } = await supabase
      .from('events')
      .insert({
        title: formData.title,
        slug: formData.slug,
        description: formData.description || null,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
        location: formData.location || null,
        is_free: formData.is_free,
        price: formData.is_free ? null : (parseFloat(formData.price) || 0),
        currency: 'KES',
        status: formData.status,
      })
      .select()
      .single();

    if (newEvent) {
      setEvents([newEvent as Event, ...events]);
      setCreateOpen(false);
      setFormData({ title: '', slug: '', description: '', starts_at: '', ends_at: '', location: '', is_free: true, price: '', status: 'draft' });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this event?')) {
      await supabase.from('events').delete().eq('id', id);
      setEvents(events.filter(e => e.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">Events</h1>
        <Button onClick={() => setCreateOpen(true)} className="font-ui rounded-full">
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
            <div key={event.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <h3 className="font-ui font-medium text-foreground">{event.title}</h3>
                <div className="flex items-center gap-4 text-xs text-muted-foreground font-ui">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(event.starts_at), 'd MMM yyyy')}</span>
                  {event.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location}</span>}
                  <span className={`px-2 py-0.5 rounded ${event.status === 'published' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{event.status}</span>
                  <span>{event.is_free ? 'Free' : `${event.currency} ${event.price?.toLocaleString()}`}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(event.id)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input type="text" placeholder="Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
            <input type="text" placeholder="Slug" value={formData.slug} onChange={(e) => setFormData({...formData, slug: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
            <textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-ui" rows={3} />
            <input type="datetime-local" value={formData.starts_at} onChange={(e) => setFormData({...formData, starts_at: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
            <input type="datetime-local" value={formData.ends_at} onChange={(e) => setFormData({...formData, ends_at: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
            <input type="text" placeholder="Location" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />
            <label className="flex items-center gap-2 font-ui text-sm">
              <input type="checkbox" checked={formData.is_free} onChange={(e) => setFormData({...formData, is_free: e.target.checked})} />
              Free event
            </label>
            {!formData.is_free && <input type="number" placeholder="Price (KES)" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-ui" />}
            <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-ui">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button onClick={handleCreate} className="w-full font-ui rounded-full">Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEvents;
