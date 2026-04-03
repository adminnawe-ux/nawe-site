import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Search, Eye, Users, UserCheck, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ClientRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  location: string | null;
  created_at: string;
  roles: string[];
  session_count: number;
  has_intake: boolean;
}

const AdminClients = () => {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientRow | null>(null);

  useEffect(() => {
    const fetch = async () => {
      // Get all profiles
      const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      // Get client roles
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      // Get session counts
      const { data: sessions } = await supabase.from('sessions').select('client_id');
      // Get intake status
      const { data: intakes } = await supabase.from('intake_responses').select('user_id, completed');

      const clientUserIds = new Set(
        (roles || []).filter(r => r.role === 'client').map(r => r.user_id)
      );

      const enriched: ClientRow[] = (profiles || [])
        .filter(p => clientUserIds.has(p.user_id))
        .map(p => ({
          user_id: p.user_id,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          country: p.country,
          location: p.location,
          created_at: p.created_at,
          roles: (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role),
          session_count: (sessions || []).filter(s => s.client_id === p.user_id).length,
          has_intake: (intakes || []).some(i => i.user_id === p.user_id && i.completed),
        }));

      setClients(enriched);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = clients.filter(c => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    return name.includes(search.toLowerCase()) || (c.phone || '').includes(search);
  });

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground mb-2">Client Management</h1>
      <p className="font-body text-muted-foreground mb-8">View client accounts, session history, and intake status.</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-card p-4 border border-border shadow-card flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-display text-xl text-foreground">{clients.length}</p>
            <p className="font-ui text-xs text-muted-foreground">Total Clients</p>
          </div>
        </div>
        <div className="bg-card rounded-card p-4 border border-border shadow-card flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-display text-xl text-foreground">{clients.filter(c => c.has_intake).length}</p>
            <p className="font-ui text-xs text-muted-foreground">Completed Intake</p>
          </div>
        </div>
        <div className="bg-card rounded-card p-4 border border-border shadow-card flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-display text-xl text-foreground">{clients.reduce((s, c) => s + c.session_count, 0)}</p>
            <p className="font-ui text-xs text-muted-foreground">Total Sessions</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 font-ui" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-card border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Name</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Location</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Sessions</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Intake</th>
                <th className="text-left font-ui text-xs text-muted-foreground p-4">Joined</th>
                <th className="text-right font-ui text-xs text-muted-foreground p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.user_id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-display text-sm text-foreground">{c.first_name || '—'} {c.last_name || ''}</td>
                  <td className="p-4 font-body text-sm text-muted-foreground">{c.location || c.country || '—'}</td>
                  <td className="p-4 font-ui text-sm text-foreground">{c.session_count}</td>
                  <td className="p-4">{c.has_intake ? <Badge className="bg-success/15 text-success border-success/20 font-ui">Done</Badge> : <Badge variant="outline" className="font-ui">Pending</Badge>}</td>
                  <td className="p-4 font-ui text-xs text-muted-foreground">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" className="font-ui gap-1.5" onClick={() => setSelected(c)}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center font-body text-muted-foreground">No clients found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{selected?.first_name} {selected?.last_name}</DialogTitle>
            <DialogDescription className="font-body">Client details</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <Detail label="Phone" value={selected.phone} />
              <Detail label="Location" value={selected.location || selected.country} />
              <Detail label="Total Sessions" value={String(selected.session_count)} />
              <Detail label="Intake Completed" value={selected.has_intake ? 'Yes' : 'No'} />
              <Detail label="Joined" value={format(new Date(selected.created_at), 'MMMM d, yyyy')} />
              <Detail label="Roles" value={selected.roles.join(', ')} />
            </div>
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

export default AdminClients;
