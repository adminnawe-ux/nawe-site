import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Link2, Loader2, Check } from 'lucide-react';

interface Props {
  sessionId: string;
  currentLink: string | null;
  onUpdate: (link: string) => void;
}

const SessionLinkEditor = ({ sessionId, currentLink, onUpdate }: Props) => {
  const [link, setLink] = useState(currentLink ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('sessions')
      .update({ session_link: link || null })
      .eq('id', sessionId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      onUpdate(link);
      toast({ title: 'Link saved', description: 'Session link has been updated.' });
    }
    setSaving(false);
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://meet.google.com/..."
          className="rounded-full h-8 text-xs pl-8"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full h-8 text-xs"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </Button>
    </div>
  );
};

export default SessionLinkEditor;
