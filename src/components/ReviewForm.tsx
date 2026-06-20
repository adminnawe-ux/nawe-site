import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Star } from 'lucide-react';

interface Props {
  therapistId?: string;
  eventId?: string;
  onSubmitted?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const ReviewForm = ({ therapistId, eventId, onSubmitted }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!user) return null;
  if (done) return (
    <div className="bg-success/10 border border-success/20 rounded-card p-4 text-center">
      <p className="font-ui text-sm text-success">Thanks for your review! It will appear after moderation.</p>
    </div>
  );

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: 'Select a rating', description: 'Please choose 1–5 stars.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Fetch reviewer's display name to store alongside the review
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const reviewer_name = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null
      : null;

    const payload: Record<string, unknown> = {
      client_id: user.id,     // original NOT NULL column
      reviewer_id: user.id,   // new alias column
      reviewer_name,
      rating,
      comment: comment.trim() || null,
      text: comment.trim() || null,  // original column
      status: 'pending',
    };
    if (therapistId) payload.therapist_id = therapistId;
    if (eventId)     payload.event_id = eventId;

    const { error } = await db.from('reviews').upsert(payload, {
      onConflict: therapistId ? 'client_id,therapist_id' : 'client_id,event_id',
    });

    if (error) {
      toast({ title: 'Could not submit', description: error.message, variant: 'destructive' });
    } else {
      setDone(true);
      onSubmitted?.();
    }
    setSaving(false);
  };

  return (
    <div className="bg-card border border-border rounded-card p-5 space-y-4">
      <p className="font-display text-base text-foreground">Leave a review</p>

      {/* Star picker */}
      <div className="flex gap-1">
        {[1,2,3,4,5].map(s => (
          <button
            key={s}
            type="button"
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(s)}
            className="p-0.5 focus:outline-none"
          >
            <Star className={`h-6 w-6 transition-colors ${s <= (hovered || rating) ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
          </button>
        ))}
      </div>

      <Textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Share your experience (optional)…"
        className="font-body text-sm resize-none"
        rows={3}
      />

      <Button onClick={handleSubmit} disabled={saving} className="font-ui w-full rounded-full">
        {saving ? 'Submitting…' : 'Submit Review'}
      </Button>
    </div>
  );
};

export default ReviewForm;
