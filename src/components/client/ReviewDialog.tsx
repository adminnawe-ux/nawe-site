import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Star, Loader2 } from 'lucide-react';

interface Props {
  sessionId: string;
  therapistId: string;
  therapistName: string;
  onReviewSubmitted?: () => void;
}

const ReviewDialog = ({ sessionId, therapistId, therapistName, onReviewSubmitted }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSaving(true);

    const { error } = await supabase.from('reviews').insert({
      client_id: user.id,
      therapist_id: therapistId,
      session_id: sessionId,
      rating,
      text: text.trim() || null,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already reviewed', description: 'You have already reviewed this session.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Review submitted', description: 'Thank you for your feedback!' });
      onReviewSubmitted?.();
      setOpen(false);
      setRating(0);
      setText('');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-ui text-xs rounded-full gap-1.5">
          <Star className="h-3.5 w-3.5" /> Leave Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Rate your session</DialogTitle>
          <DialogDescription className="font-body text-sm">
            How was your session with {therapistName}?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1 py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  star <= (hovered || rating)
                    ? 'fill-warning text-warning'
                    : 'text-border'
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your experience (optional)..."
          rows={3}
          maxLength={500}
          className="font-body"
        />
        <p className="font-ui text-[10px] text-muted-foreground text-right">{text.length}/500</p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="font-ui rounded-full">Cancel</Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || saving} className="font-ui rounded-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewDialog;
