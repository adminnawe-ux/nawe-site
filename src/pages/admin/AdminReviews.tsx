import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Star, CheckCircle2, XCircle, Trash2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Review {
  id: string;
  reviewer_id: string;
  reviewer_name: string | null;
  therapist_id: string | null;
  event_id: string | null;
  rating: number;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  therapist_name?: string | null;
  event_title?: string | null;
}

const StarRow = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(s => (
      <Star key={s} className={`h-3.5 w-3.5 ${s <= rating ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
    ))}
  </div>
);

const statusBadge = (status: string) => {
  if (status === 'approved') return <Badge className="bg-success/15 text-success border-success/20 font-ui text-xs">Approved</Badge>;
  if (status === 'rejected') return <Badge className="bg-destructive/15 text-destructive border-destructive/20 font-ui text-xs">Rejected</Badge>;
  return <Badge variant="outline" className="font-ui text-xs">Pending</Badge>;
};

const AdminReviews = () => {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [saving, setSaving] = useState<string | null>(null);

  const fetchReviews = async () => {
    const { data, error } = await db
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setLoading(false); return; }
    if (!data) { setLoading(false); return; }

    // Batch-fetch therapist names and event titles
    const therapistIds = [...new Set(data.filter((r: Review) => r.therapist_id).map((r: Review) => r.therapist_id))] as string[];
    const eventIds     = [...new Set(data.filter((r: Review) => r.event_id).map((r: Review) => r.event_id))] as string[];

    const [therapistsRes, eventsRes] = await Promise.all([
      therapistIds.length
        ? supabase.from('therapist_public_profiles').select('id, display_name').in('id', therapistIds)
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? supabase.from('events').select('id, title').in('id', eventIds)
        : Promise.resolve({ data: [] }),
    ]);

    const tMap = Object.fromEntries((therapistsRes.data ?? []).map((t: { id: string; display_name: string }) => [t.id, t.display_name]));
    const eMap = Object.fromEntries((eventsRes.data ?? []).map((e: { id: string; title: string }) => [e.id, e.title]));

    setReviews(data.map((r: Review) => ({
      ...r,
      therapist_name: r.therapist_id ? tMap[r.therapist_id] ?? null : null,
      event_title:    r.event_id     ? eMap[r.event_id]     ?? null : null,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    setSaving(id);
    const { error } = await db.from('reviews').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: status === 'approved' ? 'Review approved' : 'Review rejected' });
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
    setSaving(null);
  };

  const deleteReview = async (id: string) => {
    const { error } = await db.from('reviews').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted' });
      setReviews(prev => prev.filter(r => r.id !== id));
    }
  };

  const filtered = reviews.filter(r => filter === 'all' || r.status === filter);
  const pending  = reviews.filter(r => r.status === 'pending').length;

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground mb-2">Reviews</h1>
          <p className="font-body text-muted-foreground">Moderate reviews before they appear publicly.</p>
        </div>
        {pending > 0 && (
          <Badge className="bg-warning/15 text-warning border-warning/20 font-ui self-start sm:self-auto">
            {pending} pending
          </Badge>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {['pending','approved','rejected','all'].map(s => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" className="font-ui capitalize" onClick={() => setFilter(s)}>
            {s} {s !== 'all' && `(${reviews.filter(r => r.status === s).length})`}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(r => (
          <div key={r.id} className="bg-card rounded-card border border-border shadow-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Subject */}
                <div className="flex items-center gap-2 mb-2">
                  {statusBadge(r.status)}
                  <span className="font-ui text-xs text-muted-foreground">
                    {r.therapist_name ? `Therapist: ${r.therapist_name}` : r.event_title ? `Event: ${r.event_title}` : '—'}
                  </span>
                  <span className="font-ui text-xs text-muted-foreground">· {format(new Date(r.created_at), 'MMM d, yyyy')}</span>
                </div>
                {/* Stars + reviewer */}
                <div className="flex items-center gap-3 mb-3">
                  <StarRow rating={r.rating} />
                  <span className="font-ui text-sm text-foreground">{r.reviewer_name ?? 'Anonymous'}</span>
                </div>
                {/* Comment */}
                {r.comment ? (
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
                ) : (
                  <p className="font-ui text-xs text-muted-foreground/60 italic">No written comment</p>
                )}
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {r.status !== 'approved' && (
                  <Button size="sm" variant="ghost" className="font-ui text-success gap-1.5" disabled={saving === r.id} onClick={() => setStatus(r.id, 'approved')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                )}
                {r.status !== 'rejected' && (
                  <Button size="sm" variant="ghost" className="font-ui text-muted-foreground gap-1.5" disabled={saving === r.id} onClick={() => setStatus(r.id, 'rejected')}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="font-ui text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display">Delete review?</AlertDialogTitle>
                      <AlertDialogDescription className="font-body">This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="font-ui">Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground font-ui" onClick={() => deleteReview(r.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-card rounded-card border border-border p-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-lg text-foreground mb-1">No {filter === 'all' ? '' : filter} reviews</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReviews;
