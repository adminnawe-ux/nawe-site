import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle, XCircle, Eye, Shield, Clock } from 'lucide-react';

interface TherapistRow {
  id: string;
  user_id: string;
  professional_title: string | null;
  license_number: string | null;
  issuing_body: string | null;
  specialisations: string[] | null;
  languages: string[] | null;
  years_experience: number | null;
  verified: boolean | null;
  verification_status: string | null;
  price_per_session: number | null;
  currency: string | null;
  created_at: string;
  profile?: { first_name: string | null; last_name: string | null; email?: string } | null;
}

const AdminTherapists = () => {
  const { toast } = useToast();
  const [therapists, setTherapists] = useState<TherapistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<TherapistRow | null>(null);

  const fetchTherapists = async () => {
    const { data, error } = await supabase
      .from('therapists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const enriched: TherapistRow[] = [];
    for (const t of data || []) {
      const { data: profile } = await supabase
        .from('therapist_public_profiles')
        .select('first_name, last_name')
        .eq('user_id', t.user_id)
        .maybeSingle();
      enriched.push({ ...t, profile });
    }
    setTherapists(enriched);
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
      toast({ title: 'Updated', description: `Therapist ${status}.` });
      fetchTherapists();
      setSelected(null);
    }
  };

  const statusBadge = (status: string | null) => {
    switch (status) {
      case 'verified': return <Badge className="bg-success/15 text-success border-success/20 font-ui">Verified</Badge>;
      case 'rejected': return <Badge variant="destructive" className="font-ui">Rejected</Badge>;
      default: return <Badge className="bg-warning/15 text-warning border-warning/20 font-ui">Pending</Badge>;
    }
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
      <h1 className="font-display text-3xl text-foreground mb-2">Therapist Management</h1>
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
          { label: 'Verified', value: therapists.filter(t => t.verified).length, icon: CheckCircle },
          { label: 'Pending', value: therapists.filter(t => t.verification_status === 'pending').length, icon: Clock },
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
                    <Button variant="ghost" size="sm" className="font-ui gap-1.5" onClick={() => setSelected(t)}>
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

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selected?.profile?.first_name} {selected?.profile?.last_name}
            </DialogTitle>
            <DialogDescription className="font-body">{selected?.professional_title}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Detail label="License #" value={selected.license_number} />
                <Detail label="Issuing Body" value={selected.issuing_body} />
                <Detail label="Experience" value={selected.years_experience ? `${selected.years_experience} years` : null} />
                <Detail label="Rate" value={selected.price_per_session ? `${selected.currency || 'KES'} ${selected.price_per_session.toLocaleString()}` : null} />
              </div>
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
              <div className="flex items-center gap-2">
                <p className="font-ui text-xs text-muted-foreground">Current Status:</p>
                {statusBadge(selected.verification_status)}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selected?.verification_status !== 'approved' && (
              <Button className="font-ui gap-1.5" onClick={() => selected && updateStatus(selected.id, 'approved', true)}>
                <CheckCircle className="h-4 w-4" /> Verify
              </Button>
            )}
            {selected?.verification_status !== 'rejected' && (
              <Button variant="destructive" className="font-ui gap-1.5" onClick={() => selected && updateStatus(selected.id, 'rejected', false)}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            )}
          </DialogFooter>
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
