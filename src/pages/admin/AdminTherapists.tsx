import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle, XCircle, Eye, Shield, Clock, Pencil, FileText } from 'lucide-react';

interface TherapistRow {
  id: string;
  user_id: string;
  professional_title: string | null;
  license_number: string | null;
  issuing_body: string | null;
  specialisations: string[] | null;
  languages: string[] | null;
  modalities: string[] | null;
  years_experience: number | null;
  bio: string | null;
  photo_url: string | null;
  tagline: string | null;
  verified: boolean | null;
  verification_status: string | null;
  price_per_session: number | null;
  currency: string | null;
  cv_url: string | null;
  created_at: string;
  profile?: { first_name: string | null; last_name: string | null } | null;
}

interface EditForm {
  professional_title: string;
  license_number: string;
  issuing_body: string;
  years_experience: string;
  gender: string;
  bio: string;
  price_per_session: string;
  currency: string;
  specialisations: string;
  languages: string;
}

const AdminTherapists = () => {
  const { toast } = useToast();
  const [therapists, setTherapists] = useState<TherapistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<TherapistRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    professional_title: '',
    license_number: '',
    issuing_body: '',
    years_experience: '',
    gender: '',
    bio: '',
    price_per_session: '',
    currency: 'KES',
    specialisations: '',
    languages: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchTherapists = async () => {
    const { data: therapistData, error } = await supabase
      .from('therapists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { setLoading(false); return; }

    // Batch-fetch all profiles in one query (avoids N+1)
    const userIds = (therapistData || []).map(t => t.user_id);
    const { data: profilesData } = userIds.length
      ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
      : { data: [] };

    const profileMap = new Map((profilesData || []).map(p => [p.user_id, p]));

    setTherapists((therapistData || []).map(t => ({
      ...t,
      profile: profileMap.get(t.user_id) ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchTherapists(); }, []);

  const updateStatus = async (id: string, status: string, verified: boolean) => {
    const { error } = await supabase
      .from('therapists')
      .update({ verification_status: status, verified })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `Therapist marked as ${status}.` });
      fetchTherapists();
      setSelected(null);
    }
  };

  const openEdit = (t: TherapistRow) => {
    setEditForm({
      professional_title: t.professional_title ?? '',
      license_number: t.license_number ?? '',
      issuing_body: t.issuing_body ?? '',
      years_experience: t.years_experience?.toString() ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gender: (t as any).gender ?? '',
      bio: t.bio ?? '',
      price_per_session: t.price_per_session?.toString() ?? '',
      currency: t.currency ?? 'KES',
      specialisations: (t.specialisations ?? []).join(', '),
      languages: (t.languages ?? []).join(', '),
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from('therapists')
      .update({
        professional_title: editForm.professional_title || null,
        license_number: editForm.license_number || null,
        issuing_body: editForm.issuing_body || null,
        years_experience: editForm.years_experience ? parseInt(editForm.years_experience) : null,
        gender: editForm.gender || null,
        bio: editForm.bio || null,
        price_per_session: editForm.price_per_session ? parseInt(editForm.price_per_session) : null,
        currency: editForm.currency || 'KES',
        specialisations: editForm.specialisations
          ? editForm.specialisations.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        languages: editForm.languages
          ? editForm.languages.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated' });
      setEditMode(false);
      fetchTherapists();
      setSelected(null);
    }
  };

  const viewCv = async (cvPath: string) => {
    const { data, error } = await supabase.storage
      .from('therapist-cvs')
      .createSignedUrl(cvPath, 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open CV', description: error?.message ?? 'Try again.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  // 'approved' was saved by a previous version of this page; treat it as 'verified'
  const isVerified = (status: string | null) => status === 'verified' || status === 'approved';

  const statusBadge = (status: string | null) => {
    if (isVerified(status)) return <Badge className="bg-success/15 text-success border-success/20 font-ui">Verified</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="font-ui">Rejected</Badge>;
    return <Badge className="bg-warning/15 text-warning border-warning/20 font-ui">Pending</Badge>;
  };

  const filtered = therapists.filter((t) => {
    const name = `${t.profile?.first_name || ''} ${t.profile?.last_name || ''}`.toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || (t.license_number || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.verification_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <h1 className="font-display text-3xl text-foreground">Therapist Management</h1>
      </div>
      <p className="font-body text-muted-foreground mb-8">Review applications, verify credentials, and manage therapist profiles.</p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or license..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 font-ui" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 font-ui"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total', value: therapists.length, icon: Shield },
          { label: 'Verified', value: therapists.filter(t => isVerified(t.verification_status)).length, icon: CheckCircle },
          { label: 'Pending', value: therapists.filter(t => !isVerified(t.verification_status) && t.verification_status !== 'rejected').length, icon: Clock },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-card p-4 border border-border shadow-card flex items-center gap-3">
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-display text-xl text-foreground">{s.value}</p>
              <p className="font-ui text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-card border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Name</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Title</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">License</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Experience</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Status</th>
                <th className="text-right font-ui text-xs text-muted-foreground p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <p className="font-display text-sm text-foreground">{t.profile?.first_name || '—'} {t.profile?.last_name || ''}</p>
                  </td>
                  <td className="p-4 font-body text-sm text-muted-foreground">{t.professional_title || '—'}</td>
                  <td className="p-4 font-ui text-xs text-muted-foreground">{t.license_number || '—'}</td>
                  <td className="p-4 font-ui text-sm text-muted-foreground">{t.years_experience ? `${t.years_experience} yrs` : '—'}</td>
                  <td className="p-4">{statusBadge(t.verification_status)}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" className="font-ui gap-1.5" onClick={() => { setSelected(t); setEditMode(false); }}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center font-body text-muted-foreground">No therapists found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Edit Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditMode(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selected?.profile?.first_name} {selected?.profile?.last_name}
            </DialogTitle>
            <DialogDescription className="font-body">{selected?.professional_title || 'Therapist profile'}</DialogDescription>
          </DialogHeader>

          {selected && !editMode && (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Detail label="License #" value={selected.license_number} />
                  <Detail label="Issuing Body" value={selected.issuing_body} />
                  <Detail label="Experience" value={selected.years_experience ? `${selected.years_experience} years` : null} />
                  <Detail label="Rate" value={selected.price_per_session ? `${selected.currency || 'KES'} ${selected.price_per_session.toLocaleString()}` : null} />
                </div>
                {selected.bio && (
                  <div>
                    <p className="font-ui text-xs text-muted-foreground mb-1">Bio</p>
                    <p className="font-body text-sm text-foreground">{selected.bio}</p>
                  </div>
                )}
                {selected.specialisations && selected.specialisations.length > 0 && (
                  <div>
                    <p className="font-ui text-xs text-muted-foreground mb-2">Specialisations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.specialisations.map(s => <Badge key={s} variant="outline" className="font-ui text-xs">{s}</Badge>)}
                    </div>
                  </div>
                )}
                {selected.languages && selected.languages.length > 0 && (
                  <div>
                    <p className="font-ui text-xs text-muted-foreground mb-2">Languages</p>
                    <p className="font-body text-sm">{selected.languages.join(', ')}</p>
                  </div>
                )}
                {selected.photo_url && (
                  <div>
                    <p className="font-ui text-xs text-muted-foreground mb-2">Photo</p>
                    <img src={selected.photo_url} alt="Therapist" className="h-20 w-20 rounded-full object-cover border border-border" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <p className="font-ui text-xs text-muted-foreground">Current Status:</p>
                  {statusBadge(selected.verification_status)}
                </div>
                <div>
                  <p className="font-ui text-xs text-muted-foreground mb-1">Public Profile Link</p>
                  <a
                    href={`/therapist/${selected.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-ui text-xs text-primary hover:underline break-all"
                  >
                    /therapist/{selected.id}
                  </a>
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" size="sm" className="font-ui gap-1.5" onClick={() => openEdit(selected)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit Profile
                </Button>
                {selected.cv_url && (
                  <Button variant="outline" size="sm" className="font-ui gap-1.5" onClick={() => viewCv(selected.cv_url!)}>
                    <FileText className="h-3.5 w-3.5" /> View CV
                  </Button>
                )}
                {!isVerified(selected.verification_status) && (
                  <Button className="font-ui gap-1.5" onClick={() => updateStatus(selected.id, 'verified', true)}>
                    <CheckCircle className="h-4 w-4" /> Verify
                  </Button>
                )}
                {selected.verification_status !== 'rejected' && (
                  <Button variant="destructive" className="font-ui gap-1.5" onClick={() => updateStatus(selected.id, 'rejected', false)}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                )}
              </DialogFooter>
            </>
          )}

          {selected && editMode && (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="font-ui text-xs">Professional Title</Label>
                    <Input className="font-ui" value={editForm.professional_title} onChange={e => setEditForm(f => ({ ...f, professional_title: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-ui text-xs">License Number</Label>
                    <Input className="font-ui" value={editForm.license_number} onChange={e => setEditForm(f => ({ ...f, license_number: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-ui text-xs">Issuing Body</Label>
                    <Input className="font-ui" value={editForm.issuing_body} onChange={e => setEditForm(f => ({ ...f, issuing_body: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-ui text-xs">Years Experience</Label>
                    <Input className="font-ui" type="number" min="0" value={editForm.years_experience} onChange={e => setEditForm(f => ({ ...f, years_experience: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-ui text-xs">Gender</Label>
                    <Select value={editForm.gender} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                      <SelectTrigger className="font-ui"><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Non-binary / Other">Non-binary / Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-ui text-xs">Rate (per session)</Label>
                    <div className="flex gap-2">
                      <Select value={editForm.currency} onValueChange={v => setEditForm(f => ({ ...f, currency: v }))}>
                        <SelectTrigger className="w-20 font-ui"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KES">KES</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="UGX">UGX</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input className="font-ui flex-1" type="number" min="0" value={editForm.price_per_session} onChange={e => setEditForm(f => ({ ...f, price_per_session: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-ui text-xs">Bio</Label>
                  <Textarea className="font-body text-sm" rows={4} value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-ui text-xs">Specialisations <span className="text-muted-foreground">(comma-separated)</span></Label>
                  <Input className="font-ui" value={editForm.specialisations} onChange={e => setEditForm(f => ({ ...f, specialisations: e.target.value }))} placeholder="e.g. Anxiety, Depression, Trauma" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-ui text-xs">Languages <span className="text-muted-foreground">(comma-separated)</span></Label>
                  <Input className="font-ui" value={editForm.languages} onChange={e => setEditForm(f => ({ ...f, languages: e.target.value }))} placeholder="e.g. English, Swahili" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="font-ui" onClick={() => setEditMode(false)} disabled={saving}>Cancel</Button>
                <Button className="font-ui" onClick={saveEdit} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Detail = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <p className="font-ui text-xs text-muted-foreground">{label}</p>
    <p className="font-body text-sm text-foreground">{value || '—'}</p>
  </div>
);

export default AdminTherapists;
