import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Percent, Settings2 } from 'lucide-react';

interface CommissionTier {
  id: string;
  min_revenue: number;
  max_revenue: number | null;
  commission_rate: number;
  currency: string;
}

const AdminSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionTier | null>(null);

  const [minRevenue, setMinRevenue] = useState('0');
  const [maxRevenue, setMaxRevenue] = useState('');
  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [saving, setSaving] = useState(false);

  const fetchTiers = async () => {
    const { data } = await supabase
      .from('commission_tiers')
      .select('*')
      .order('min_revenue', { ascending: true });
    if (data) setTiers(data as CommissionTier[]);
    setLoading(false);
  };

  useEffect(() => { fetchTiers(); }, []);

  const openCreate = () => {
    setEditing(null);
    setMinRevenue('0');
    setMaxRevenue('');
    setRate('');
    setCurrency('KES');
    setDialogOpen(true);
  };

  const openEdit = (t: CommissionTier) => {
    setEditing(t);
    setMinRevenue(String(t.min_revenue));
    setMaxRevenue(t.max_revenue != null ? String(t.max_revenue) : '');
    setRate(String(t.commission_rate));
    setCurrency(t.currency);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      toast({ title: 'Invalid rate', description: 'Must be between 0 and 100.', variant: 'destructive' });
      return;
    }
    const minNum = parseInt(minRevenue) || 0;
    const maxNum = maxRevenue ? parseInt(maxRevenue) : null;

    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('commission_tiers')
        .update({ min_revenue: minNum, max_revenue: maxNum, commission_rate: rateNum, currency })
        .eq('id', editing.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Tier updated' });
      }
    } else {
      const { error } = await supabase
        .from('commission_tiers')
        .insert({ min_revenue: minNum, max_revenue: maxNum, commission_rate: rateNum, currency });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Tier created' });
      }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchTiers();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('commission_tiers').delete().eq('id', id);
    toast({ title: 'Tier deleted' });
    fetchTiers();
  };

  const formatCurrency = (amount: number, cur: string) =>
    `${cur} ${amount.toLocaleString()}`;

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground mb-2">Platform Settings</h1>
      <p className="font-body text-muted-foreground mb-10">Configure commission rates, features, and integrations.</p>

      {/* Commission Tiers */}
      <div className="bg-card rounded-card p-8 shadow-card border border-border mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Percent className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl text-foreground">Commission Tiers</h2>
          </div>
          <Button onClick={openCreate} size="sm" className="font-ui gap-2">
            <Plus className="h-4 w-4" /> Add Tier
          </Button>
        </div>

        <p className="font-body text-sm text-muted-foreground mb-6">
          Tiered commission rates based on therapist monthly revenue. The platform deducts this percentage from session fees.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : tiers.length === 0 ? (
          <p className="font-body text-muted-foreground text-center py-8">No tiers configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-ui text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 pr-4">Revenue Range</th>
                  <th className="pb-3 pr-4">Commission Rate</th>
                  <th className="pb-3 pr-4">Currency</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 last:border-0">
                    <td className="py-4 pr-4 text-foreground">
                      {formatCurrency(t.min_revenue, t.currency)}
                      {' — '}
                      {t.max_revenue != null ? formatCurrency(t.max_revenue, t.currency) : '∞'}
                    </td>
                    <td className="py-4 pr-4 text-foreground font-medium">{t.commission_rate}%</td>
                    <td className="py-4 pr-4 text-muted-foreground">{t.currency}</td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this tier?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(t.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* General Settings placeholder */}
      <div className="bg-card rounded-card p-8 shadow-card border border-border">
        <div className="flex items-center gap-3 mb-4">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl text-foreground">General Settings</h2>
        </div>
        <p className="font-body text-muted-foreground text-center py-6">More settings coming soon.</p>
      </div>

      {/* Tier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? 'Edit' : 'Add'} Commission Tier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-ui">Min Revenue</Label>
                <Input type="number" value={minRevenue} onChange={(e) => setMinRevenue(e.target.value)} min={0} className="font-ui" />
              </div>
              <div className="space-y-2">
                <Label className="font-ui">Max Revenue <span className="text-muted-foreground">(empty = unlimited)</span></Label>
                <Input type="number" value={maxRevenue} onChange={(e) => setMaxRevenue(e.target.value)} min={0} placeholder="∞" className="font-ui" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-ui">Commission Rate (%)</Label>
                <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} min={0} max={100} step={0.5} className="font-ui" />
              </div>
              <div className="space-y-2">
                <Label className="font-ui">Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="font-ui" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-ui">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !rate} className="font-ui">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettings;
