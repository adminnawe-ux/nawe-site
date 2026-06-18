import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Calendar, MapPin, Trash2, ExternalLink, Pencil, Users, CheckCircle2, Circle,
  Mail, Ticket, Search, Upload, X, ImageIcon, ChevronDown, ChevronRight, Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { usePlacesAutocomplete } from '@/hooks/usePlacesAutocomplete';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

interface TierFormRow {
  _key: string; // local draft key
  id?: string;  // set when persisted
  name: string;
  ticket_type: 'individual' | 'group';
  group_size: string;
  price: string;
  capacity: string;
  sale_starts_at: string;
  sale_ends_at: string;
  sort_order: number;
}

interface Registration {
  id: string;
  attendee_name: string;
  attendee_email: string;
  ticket_code: string;
  payment_status: string;
  price_paid: number | null;
  checked_in: boolean;
  created_at: string;
  tier_id: string | null;
  group_lead_id: string | null;
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
  status: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormData = {
  title: '', slug: '', description: '', starts_at: '', ends_at: '',
  location: '', location_url: '', poster_url: '', status: 'draft',
};

function newTierRow(sort_order: number): TierFormRow {
  return {
    _key: crypto.randomUUID(),
    name: '', ticket_type: 'individual', group_size: '',
    price: '', capacity: '', sale_starts_at: '', sale_ends_at: '',
    sort_order,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDatetimeValue(iso: string | null) {
  if (!iso) return '';
  return iso.slice(0, 16);
}

function eventToForm(e: Event): FormData {
  return {
    title: e.title, slug: e.slug, description: e.description ?? '',
    starts_at: toLocalDatetimeValue(e.starts_at), ends_at: toLocalDatetimeValue(e.ends_at),
    location: e.location ?? '', location_url: e.location_url ?? '',
    poster_url: e.poster_url ?? '', status: e.status,
  };
}

function tierToFormRow(t: TicketTier): TierFormRow {
  return {
    _key: t.id,
    id: t.id,
    name: t.name,
    ticket_type: t.ticket_type,
    group_size: t.group_size != null ? String(t.group_size) : '',
    price: String(t.price),
    capacity: t.capacity != null ? String(t.capacity) : '',
    sale_starts_at: toLocalDatetimeValue(t.sale_starts_at),
    sale_ends_at: toLocalDatetimeValue(t.sale_ends_at),
    sort_order: t.sort_order,
  };
}

// ─── Tier Manager sub-component ───────────────────────────────────────────────

interface TierManagerProps {
  tiers: TierFormRow[];
  onChange: (tiers: TierFormRow[]) => void;
}

const TierManager = ({ tiers, onChange }: TierManagerProps) => {
  const update = (key: string, patch: Partial<TierFormRow>) =>
    onChange(tiers.map(t => t._key === key ? { ...t, ...patch } : t));
  const remove = (key: string) => onChange(tiers.filter(t => t._key !== key));
  const add = () => onChange([...tiers, newTierRow(tiers.length)]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-ui text-sm font-medium text-foreground">Ticket Tiers</label>
        <Button type="button" variant="outline" size="sm" onClick={add} className="font-ui text-xs gap-1.5 h-7">
          <Plus className="h-3 w-3" /> Add tier
        </Button>
      </div>

      {tiers.length === 0 && (
        <p className="font-ui text-xs text-muted-foreground border border-dashed rounded-lg p-3 text-center">
          No tiers yet — add one above. If no tiers are set the event is treated as free.
        </p>
      )}

      {tiers.map((tier, i) => (
        <div key={tier._key} className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-ui text-xs text-muted-foreground">Tier {i + 1}</span>
            <button type="button" onClick={() => remove(tier._key)}
              className="ml-auto text-destructive hover:text-destructive/80 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <input type="text" placeholder="Tier name *  (e.g. Early Bird, Group of 4)"
                value={tier.name}
                onChange={e => update(tier._key, { name: e.target.value })}
                className="w-full px-2.5 py-1.5 border rounded-md text-xs font-ui" />
            </div>

            <div>
              <label className="block font-ui text-xs text-muted-foreground mb-1">Type</label>
              <select value={tier.ticket_type}
                onChange={e => update(tier._key, { ticket_type: e.target.value as 'individual' | 'group', group_size: '' })}
                className="w-full px-2.5 py-1.5 border rounded-md text-xs font-ui">
                <option value="individual">Individual</option>
                <option value="group">Group</option>
              </select>
            </div>

            {tier.ticket_type === 'group' ? (
              <div>
                <label className="block font-ui text-xs text-muted-foreground mb-1">Group size *</label>
                <input type="number" min={2} placeholder="e.g. 4"
                  value={tier.group_size}
                  onChange={e => update(tier._key, { group_size: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded-md text-xs font-ui" />
              </div>
            ) : (
              <div /> /* spacer */
            )}

            <div>
              <label className="block font-ui text-xs text-muted-foreground mb-1">Price (KES) *</label>
              <input type="number" min={0} placeholder="0 = free"
                value={tier.price}
                onChange={e => update(tier._key, { price: e.target.value })}
                className="w-full px-2.5 py-1.5 border rounded-md text-xs font-ui" />
            </div>

            <div>
              <label className="block font-ui text-xs text-muted-foreground mb-1">Slots available</label>
              <input type="number" min={1} placeholder="Unlimited"
                value={tier.capacity}
                onChange={e => update(tier._key, { capacity: e.target.value })}
                className="w-full px-2.5 py-1.5 border rounded-md text-xs font-ui" />
            </div>

            <div>
              <label className="block font-ui text-xs text-muted-foreground mb-1">Sale opens</label>
              <input type="datetime-local" value={tier.sale_starts_at}
                onChange={e => update(tier._key, { sale_starts_at: e.target.value })}
                className="w-full px-2.5 py-1.5 border rounded-md text-xs font-ui" />
            </div>

            <div>
              <label className="block font-ui text-xs text-muted-foreground mb-1">Sale closes</label>
              <input type="datetime-local" value={tier.sale_ends_at}
                onChange={e => update(tier._key, { sale_ends_at: e.target.value })}
                className="w-full px-2.5 py-1.5 border rounded-md text-xs font-ui" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── EventForm ────────────────────────────────────────────────────────────────

interface EventFormProps {
  formData: FormData;
  setFormData: (f: FormData) => void;
  tiers: TierFormRow[];
  setTiers: (t: TierFormRow[]) => void;
  locationRef: React.RefObject<HTMLInputElement>;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
  error: string;
}

const EventForm = ({ formData, setFormData, tiers, setTiers, locationRef, onSubmit, submitLabel, saving, error }: EventFormProps) => {
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

      <select value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        className="w-full px-3 py-2 border rounded-lg text-sm font-ui">
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="cancelled">Cancelled</option>
        <option value="completed">Completed</option>
      </select>

      <TierManager tiers={tiers} onChange={setTiers} />

      <Button onClick={onSubmit} disabled={saving || uploading} className="w-full font-ui rounded-full">
        {saving ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
};

// ─── Attendees panel ──────────────────────────────────────────────────────────

interface AttendeesPanelProps {
  event: Event | null;
  tiers: TicketTier[];
  registrations: Registration[];
  loading: boolean;
  onToggleCheckIn: (reg: Registration) => void;
  onWaitlistApproved: (ids: string[]) => void;
}

const AttendeesPanel = ({ event, tiers, registrations, loading, onToggleCheckIn, onWaitlistApproved }: AttendeesPanelProps) => {
  const [tab, setTab] = useState<'attendees' | 'waitlist'>('attendees');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);

  const toggleGroup = (id: string) =>
    setExpandedGroups(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });

  // Split registrations by status
  const activeRegs = registrations.filter(r => !r.group_lead_id && !['waitlisted', 'approved_waitlist'].includes(r.payment_status));
  const waitlistRegs = registrations.filter(r => r.payment_status === 'waitlisted');
  const approvedWaitlistRegs = registrations.filter(r => r.payment_status === 'approved_waitlist');
  const membersByLead = registrations.reduce<Record<string, Registration[]>>((acc, r) => {
    if (r.group_lead_id) { acc[r.group_lead_id] = [...(acc[r.group_lead_id] ?? []), r]; }
    return acc;
  }, {});

  const allWaitlisted = waitlistRegs;
  const allWaitlistedIds = allWaitlisted.map(r => r.id);
  const allSelected = allWaitlistedIds.length > 0 && allWaitlistedIds.every(id => selected.has(id));

  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(allWaitlistedIds));

  const handleApprove = async () => {
    const ids = [...selected].filter(id => waitlistRegs.some(r => r.id === id));
    if (ids.length === 0) return;
    setApproving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error: invokeErr } = await supabase.functions.invoke('approve-waitlist', {
        body: { registration_ids: ids },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (invokeErr || !data) throw invokeErr ?? new Error('Unknown error');
      if (data.approved?.length > 0) {
        onWaitlistApproved(data.approved);
        setSelected(new Set());
      }
      if (data.failed?.length > 0) {
        alert(`${data.failed.length} approval(s) failed. Please try again.`);
      }
    } catch (err) {
      alert('Approval failed. Please try again.');
      console.error(err);
    } finally {
      setApproving(false);
    }
  };

  // Per-tier stats
  const tierStats = tiers.map(tier => {
    const tierRegs = registrations.filter(r => r.tier_id === tier.id && !['waitlisted', 'approved_waitlist'].includes(r.payment_status));
    const confirmed = tierRegs.filter(r => r.payment_status === 'paid' || r.payment_status === 'free');
    const revenue = tierRegs.filter(r => r.payment_status === 'paid').reduce((s, r) => s + (r.price_paid ?? 0), 0);
    return { tier, confirmed: confirmed.length, checkedIn: confirmed.filter(r => r.checked_in).length, revenue };
  });

  const totalRevenue = registrations.filter(r => r.payment_status === 'paid').reduce((s, r) => s + (r.price_paid ?? 0), 0);

  const paymentBadge = (status: string) => {
    if (status === 'paid' || status === 'free') return 'bg-success/10 text-success border-success/20';
    if (status === 'pending_stk') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (status === 'approved_waitlist') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
  };
  const paymentLabel = (status: string) => {
    if (status === 'paid') return 'Paid';
    if (status === 'free') return 'Free';
    if (status === 'pending_stk') return 'Pending';
    if (status === 'approved_waitlist') return 'Approved — pay pending';
    return 'Failed';
  };

  const RegistrationRow = ({ reg, indent = false }: { reg: Registration; indent?: boolean }) => {
    const tierName = tiers.find(t => t.id === reg.tier_id)?.name;
    return (
      <div className={`rounded-lg border p-3 flex items-center gap-3 transition-colors ${reg.checked_in ? 'border-success/30 bg-success/5' : 'border-border bg-card'} ${indent ? 'ml-6' : ''}`}>
        <button onClick={() => onToggleCheckIn(reg)} className="shrink-0" title={reg.checked_in ? 'Mark not checked in' : 'Check in'}>
          {reg.checked_in ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-ui text-sm font-medium text-foreground truncate">{reg.attendee_name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1 font-ui text-xs text-muted-foreground"><Mail className="h-3 w-3" />{reg.attendee_email}</span>
            <span className="flex items-center gap-1 font-ui text-xs text-muted-foreground"><Ticket className="h-3 w-3" />{reg.ticket_code}</span>
            {tierName && <span className="font-ui text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tierName}</span>}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <Badge className={`font-ui text-xs ${paymentBadge(reg.payment_status)}`}>{paymentLabel(reg.payment_status)}</Badge>
          {reg.price_paid != null && reg.payment_status === 'paid' && (
            <span className="font-ui text-xs text-muted-foreground">KES {reg.price_paid.toLocaleString()}</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const q = search.toLowerCase().trim();
  const visibleActive = activeRegs.filter(lead => {
    if (tierFilter !== 'all' && lead.tier_id !== tierFilter) {
      const members = membersByLead[lead.id] ?? [];
      if (!members.some(m => m.tier_id === tierFilter)) return false;
    }
    if (!q) return true;
    const members = membersByLead[lead.id] ?? [];
    return lead.attendee_name.toLowerCase().includes(q) || lead.ticket_code.toLowerCase().includes(q) ||
      members.some(m => m.attendee_name.toLowerCase().includes(q) || m.ticket_code.toLowerCase().includes(q));
  });

  const visibleWaitlist = allWaitlisted.filter(r =>
    !q || r.attendee_name.toLowerCase().includes(q) || r.attendee_email.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-xs font-ui text-muted-foreground">
        <span>{activeRegs.length} registered · {registrations.filter(r => r.checked_in).length} checked in</span>
        {totalRevenue > 0 && <span>KES {totalRevenue.toLocaleString()} collected</span>}
        {(waitlistRegs.length > 0 || approvedWaitlistRegs.length > 0) && (
          <span className="text-amber-600">{waitlistRegs.length} on waitlist{approvedWaitlistRegs.length > 0 ? ` · ${approvedWaitlistRegs.length} approved awaiting payment` : ''}</span>
        )}
      </div>

      {/* Per-tier breakdown */}
      {tierStats.length > 0 && (
        <div className="space-y-1">
          {tierStats.map(({ tier, confirmed, checkedIn, revenue }) => (
            <div key={tier.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-4 text-xs font-ui">
              <span className="font-medium text-foreground flex-1 truncate">{tier.name}</span>
              <span className="text-muted-foreground">{confirmed}{tier.capacity ? `/${tier.capacity}` : ''} confirmed</span>
              <span className="text-muted-foreground">{checkedIn} in</span>
              {revenue > 0 && <span className="text-muted-foreground">KES {revenue.toLocaleString()}</span>}
              <span className={`px-2 py-0.5 rounded ${tier.ticket_type === 'group' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {tier.ticket_type === 'group' ? `Group ×${tier.group_size}` : 'Individual'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['attendees', 'waitlist'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSearch(''); setSelected(new Set()); }}
            className={`px-4 py-2 font-ui text-sm transition-colors border-b-2 -mb-px ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'attendees' ? `Attendees (${activeRegs.length})` : `Waitlist (${waitlistRegs.length})`}
          </button>
        ))}
      </div>

      {/* ── Attendees tab ── */}
      {tab === 'attendees' && (
        <div className="space-y-3">
          {activeRegs.length > 0 && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input type="text" placeholder="Search by name or ticket #..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm font-ui bg-background" autoFocus />
              </div>
              {tiers.length > 0 && (
                <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm font-ui bg-background">
                  <option value="all">All tiers</option>
                  {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
          )}
          {activeRegs.length === 0 && <div className="text-center py-12 text-muted-foreground font-body">No registrations yet.</div>}
          {visibleActive.length === 0 && activeRegs.length > 0 && (
            <p className="text-center py-8 text-muted-foreground font-ui text-sm">No match for "{search}"</p>
          )}
          <div className="space-y-2">
            {visibleActive.map(lead => {
              const members = membersByLead[lead.id] ?? [];
              const isGroup = members.length > 0;
              const expanded = expandedGroups.has(lead.id);
              if (!isGroup) return <RegistrationRow key={lead.id} reg={lead} />;
              return (
                <div key={lead.id}>
                  <div className="rounded-lg border p-3 flex items-center gap-3 border-border bg-card">
                    <button onClick={() => onToggleCheckIn(lead)} className="shrink-0">
                      {lead.checked_in ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-ui text-sm font-medium text-foreground truncate">{lead.attendee_name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 font-ui text-xs text-muted-foreground"><Mail className="h-3 w-3" />{lead.attendee_email}</span>
                        <span className="flex items-center gap-1 font-ui text-xs text-muted-foreground"><Ticket className="h-3 w-3" />{lead.ticket_code}</span>
                        {(() => { const t = tiers.find(t => t.id === lead.tier_id); return t ? <span className="font-ui text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.name}</span> : null; })()}
                        <span className="font-ui text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">Group · {members.length + 1}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge className={`font-ui text-xs ${paymentBadge(lead.payment_status)}`}>{paymentLabel(lead.payment_status)}</Badge>
                      {lead.price_paid != null && lead.payment_status === 'paid' && (
                        <span className="font-ui text-xs text-muted-foreground">KES {lead.price_paid.toLocaleString()}</span>
                      )}
                    </div>
                    <button onClick={() => toggleGroup(lead.id)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors ml-1">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                  {expanded && members.map(m => <div key={m.id} className="mt-1"><RegistrationRow reg={m} indent /></div>)}
                </div>
              );
            })}
          </div>

          {/* Approved-waitlist awaiting payment */}
          {approvedWaitlistRegs.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="font-ui text-xs font-medium text-muted-foreground uppercase tracking-wide">Approved — awaiting payment</p>
              {approvedWaitlistRegs.map(reg => {
                const tierName = tiers.find(t => t.id === reg.tier_id)?.name;
                return (
                  <div key={reg.id} className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-ui text-sm font-medium text-foreground truncate">{reg.attendee_name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 font-ui text-xs text-muted-foreground"><Mail className="h-3 w-3" />{reg.attendee_email}</span>
                        {tierName && <span className="font-ui text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tierName}</span>}
                      </div>
                    </div>
                    <Badge className="font-ui text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">Pay pending</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Waitlist tab ── */}
      {tab === 'waitlist' && (
        <div className="space-y-3">
          {waitlistRegs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-body">No one on the waitlist.</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input type="text" placeholder="Search waitlist..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm font-ui bg-background" autoFocus />
                </div>
                {selected.size > 0 && (
                  <Button size="sm" className="font-ui rounded-full gap-1.5 shrink-0" onClick={handleApprove} disabled={approving}>
                    {approving
                      ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Approving…</>
                      : <><CheckCircle2 className="h-3.5 w-3.5" /> Approve {selected.size}</>}
                  </Button>
                )}
              </div>

              {/* Select all */}
              <label className="flex items-center gap-2 font-ui text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                  className="rounded border-border" />
                Select all ({waitlistRegs.length})
              </label>

              {visibleWaitlist.length === 0 && (
                <p className="text-center py-8 text-muted-foreground font-ui text-sm">No match for "{search}"</p>
              )}

              <div className="space-y-2">
                {visibleWaitlist.map((reg, i) => {
                  const tierName = tiers.find(t => t.id === reg.tier_id)?.name;
                  const isChecked = selected.has(reg.id);
                  return (
                    <div key={reg.id}
                      className={`rounded-lg border p-3 flex items-center gap-3 transition-colors cursor-pointer ${isChecked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}
                      onClick={() => toggleSelect(reg.id)}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(reg.id)}
                        onClick={e => e.stopPropagation()} className="shrink-0 rounded border-border" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-ui text-xs text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                          <p className="font-ui text-sm font-medium text-foreground truncate">{reg.attendee_name}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 ml-7">
                          <span className="flex items-center gap-1 font-ui text-xs text-muted-foreground"><Mail className="h-3 w-3" />{reg.attendee_email}</span>
                          {tierName && <span className="font-ui text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tierName}</span>}
                          <span className="font-ui text-xs text-muted-foreground">{new Date(reg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const AdminEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formTiers, setFormTiers] = useState<TierFormRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [attendeesEvent, setAttendeesEvent] = useState<Event | null>(null);
  const [attendeesTiers, setAttendeesTiers] = useState<TicketTier[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);

  const createLocationRef = useRef<HTMLInputElement>(null);
  const editLocationRef = useRef<HTMLInputElement>(null);

  const handlePlaceSelectCreate = useCallback(({ name, mapsUrl }: { name: string; mapsUrl: string }) => {
    setFormData(prev => ({ ...prev, location: name, location_url: mapsUrl }));
  }, []);
  const handlePlaceSelectEdit = useCallback(({ name, mapsUrl }: { name: string; mapsUrl: string }) => {
    setFormData(prev => ({ ...prev, location: name, location_url: mapsUrl }));
  }, []);

  usePlacesAutocomplete(createLocationRef, handlePlaceSelectCreate, createOpen);
  usePlacesAutocomplete(editLocationRef, handlePlaceSelectEdit, !!editEvent);

  useEffect(() => {
    db.from('events')
      .select('id, slug, title, description, starts_at, ends_at, location, location_url, poster_url, status, is_free, price, currency')
      .order('starts_at', { ascending: false })
      .then(({ data }: { data: Event[] }) => { setEvents(data ?? []); setLoading(false); });
  }, []);

  const buildEventPayload = (f: FormData) => ({
    title: f.title, slug: f.slug, description: f.description || null,
    starts_at: new Date(f.starts_at).toISOString(),
    ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    location: f.location || null, location_url: f.location_url || null,
    poster_url: f.poster_url || null,
    // keep is_free/price as derived from tiers for backwards compat
    is_free: formTiers.length === 0 || formTiers.every(t => parseFloat(t.price) === 0),
    price: formTiers.length > 0 ? Math.min(...formTiers.map(t => parseFloat(t.price) || 0)) : null,
    currency: 'KES', status: f.status,
  });

  const validateTiers = (): string => {
    for (const t of formTiers) {
      if (!t.name.trim()) return 'Every tier must have a name.';
      if (t.price === '' || isNaN(parseFloat(t.price))) return `Tier "${t.name || '(unnamed)'}" needs a price (0 for free).`;
      if (t.ticket_type === 'group' && (!t.group_size || parseInt(t.group_size) < 2))
        return `Group tier "${t.name}" needs a group size of at least 2.`;
    }
    return '';
  };

  const saveTiers = async (eventId: string, isEdit: boolean) => {
    if (isEdit) {
      // Delete tiers that were removed (not in formTiers ids)
      const keptIds = formTiers.filter(t => t.id).map(t => t.id!);
      const { data: existing } = await db.from('event_ticket_tiers').select('id').eq('event_id', eventId);
      const toDelete = (existing ?? []).filter((r: { id: string }) => !keptIds.includes(r.id)).map((r: { id: string }) => r.id);
      if (toDelete.length > 0) {
        await db.from('event_ticket_tiers').delete().in('id', toDelete);
      }
    }

    for (const [i, t] of formTiers.entries()) {
      const payload = {
        event_id: eventId,
        name: t.name.trim(),
        ticket_type: t.ticket_type,
        group_size: t.ticket_type === 'group' ? parseInt(t.group_size) : null,
        price: parseFloat(t.price) || 0,
        currency: 'KES',
        capacity: t.capacity ? parseInt(t.capacity) : null,
        sale_starts_at: t.sale_starts_at ? new Date(t.sale_starts_at).toISOString() : null,
        sale_ends_at: t.sale_ends_at ? new Date(t.sale_ends_at).toISOString() : null,
        sort_order: i,
      };
      if (t.id) {
        await db.from('event_ticket_tiers').update(payload).eq('id', t.id);
      } else {
        await db.from('event_ticket_tiers').insert(payload);
      }
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.slug.trim() || !formData.starts_at) return;
    const tierErr = validateTiers();
    if (tierErr) { setError(tierErr); return; }
    setSaving(true); setError('');
    const { data: newEvent, error: err } = await db.from('events').insert(buildEventPayload(formData)).select().single();
    if (err) { setError(err.message.includes('unique') ? 'Slug already exists — choose a different one.' : err.message); setSaving(false); return; }
    if (newEvent) {
      await saveTiers(newEvent.id, false);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-event-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ event_id: newEvent.id, title: formData.title, location: formData.location || null, starts_at: new Date(formData.starts_at).toISOString(), ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null }),
        });
      } catch (e) { console.error('Calendar creation failed:', e); }
      setEvents(prev => [newEvent as Event, ...prev]);
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
      setFormTiers([]);
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editEvent || !formData.title.trim() || !formData.starts_at) return;
    const tierErr = validateTiers();
    if (tierErr) { setError(tierErr); return; }
    setSaving(true); setError('');
    const { data: updated, error: err } = await db.from('events').update(buildEventPayload(formData)).eq('id', editEvent.id).select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    if (updated) {
      await saveTiers(editEvent.id, true);
      setEvents(prev => prev.map(e => e.id === editEvent.id ? updated as Event : e));
      setEditEvent(null);
      setFormTiers([]);
    }
    setSaving(false);
  };

  const openAttendees = async (event: Event) => {
    setAttendeesEvent(event);
    setRegsLoading(true);
    const [{ data: tiers }, { data: regs }] = await Promise.all([
      db.from('event_ticket_tiers').select('*').eq('event_id', event.id).order('sort_order'),
      db.from('event_registrations')
        .select('id, attendee_name, attendee_email, ticket_code, payment_status, price_paid, checked_in, created_at, tier_id, group_lead_id')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true }),
    ]);
    setAttendeesTiers(tiers ?? []);
    setRegistrations(regs ?? []);
    setRegsLoading(false);
  };

  const toggleCheckIn = async (reg: Registration) => {
    const { data } = await db.from('event_registrations')
      .update({ checked_in: !reg.checked_in })
      .eq('id', reg.id)
      .select('id, checked_in')
      .single();
    if (data) setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, checked_in: data.checked_in } : r));
  };

  // Called after approve-waitlist succeeds — update local state so the panel
  // reflects the new statuses without a full reload.
  const handleWaitlistApproved = (approvedIds: string[]) => {
    setRegistrations(prev => prev.map(r => {
      if (!approvedIds.includes(r.id)) return r;
      // Free events: approved → free. Paid events: approved → approved_waitlist.
      // The edge function handles the distinction; we optimistically move to
      // approved_waitlist here and let a paid-event user's eventual payment flip it to paid.
      const newStatus = attendeesEvent?.is_free ? 'free' : 'approved_waitlist';
      return { ...r, payment_status: newStatus };
    }));
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this event? This cannot be undone.')) {
      await db.from('events').delete().eq('id', id);
      setEvents(prev => prev.filter(e => e.id !== id));
    }
  };

  const openEdit = async (event: Event) => {
    setFormData(eventToForm(event));
    setError('');
    // load existing tiers into form rows
    const { data: tiers } = await db.from('event_ticket_tiers').select('*').eq('event_id', event.id).order('sort_order');
    setFormTiers((tiers ?? []).map(tierToFormRow));
    setEditEvent(event);
  };

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setFormTiers([]);
    setError('');
    setCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">Events</h1>
        <Button onClick={openCreate} className="font-ui rounded-full">
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
                  <span>{event.is_free ? 'Free' : `from KES ${event.price?.toLocaleString()}`}</span>
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
          <EventForm formData={formData} setFormData={setFormData} tiers={formTiers} setTiers={setFormTiers}
            locationRef={createLocationRef} onSubmit={handleCreate} submitLabel="Create Event" saving={saving} error={error} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editEvent} onOpenChange={(open) => { if (!open) { setEditEvent(null); setFormTiers([]); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
          <EventForm formData={formData} setFormData={setFormData} tiers={formTiers} setTiers={setFormTiers}
            locationRef={editLocationRef} onSubmit={handleEdit} submitLabel="Save Changes" saving={saving} error={error} />
        </DialogContent>
      </Dialog>

      {/* Attendees sheet */}
      <Sheet open={!!attendeesEvent} onOpenChange={(open) => { if (!open) setAttendeesEvent(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display text-lg">{attendeesEvent?.title}</SheetTitle>
          </SheetHeader>
          <AttendeesPanel
            event={attendeesEvent}
            tiers={attendeesTiers}
            registrations={registrations}
            loading={regsLoading}
            onToggleCheckIn={toggleCheckIn}
            onWaitlistApproved={handleWaitlistApproved}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminEvents;
