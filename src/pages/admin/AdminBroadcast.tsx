import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RichTextEditor from '@/components/RichTextEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Users, History } from 'lucide-react';
import { format } from 'date-fns';

const ROLE_OPTIONS = [
  { value: 'client', label: 'Clients' },
  { value: 'therapist', label: 'Therapists' },
  { value: 'admin', label: 'Admins' },
];

interface BroadcastSend {
  id: string;
  subject: string;
  audience_roles: string[];
  include_newsletter: boolean;
  cc_addresses: string[];
  recipient_count: number;
  failed_count: number;
  sent_at: string;
}

const AdminBroadcast = () => {
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [cc, setCc] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [includeNewsletter, setIncludeNewsletter] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<BroadcastSend[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const audienceSelected = roles.length > 0 || includeNewsletter;
  const canSend = subject.trim() && body && body !== '<p></p>' && audienceSelected;

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('broadcast_sends')
      .select('id, subject, audience_roles, include_newsletter, cc_addresses, recipient_count, failed_count, sent_at')
      .order('sent_at', { ascending: false })
      .limit(20);
    setHistory(data ?? []);
    setLoadingHistory(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  // Any change to the audience invalidates the last preview count.
  useEffect(() => { setPreviewCount(null); }, [roles, includeNewsletter]);

  const toggleRole = (role: string) =>
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const invokeSendBroadcast = async (preview: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession();
    return supabase.functions.invoke('send-broadcast', {
      body: { subject, body, roles, include_newsletter: includeNewsletter, cc, preview },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });
  };

  const handlePreview = async () => {
    if (!audienceSelected) return;
    setPreviewing(true);
    try {
      const { data, error } = await invokeSendBroadcast(true);
      if (error || !data) throw error ?? new Error('Unknown error');
      setPreviewCount(data.recipient_count);
    } catch {
      toast({ title: 'Could not load recipient count', variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await invokeSendBroadcast(false);
      if (error || !data) throw error ?? new Error('Unknown error');
      toast({ title: `Sent to ${data.sent} recipient${data.sent === 1 ? '' : 's'}${data.failed ? ` (${data.failed} failed)` : ''}` });
      setSubject('');
      setBody('');
      setCc('');
      setRoles([]);
      setIncludeNewsletter(false);
      setPreviewCount(null);
      fetchHistory();
    } catch {
      toast({ title: 'Send failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground mb-2">Broadcast</h1>
      <p className="font-body text-muted-foreground mb-8">Send a one-off email announcement to a group of users or newsletter subscribers.</p>

      <div className="bg-card rounded-card border border-border shadow-card p-6 mb-8 space-y-5">
        <div className="space-y-2">
          <Label className="font-ui">Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="font-ui" placeholder="Subject line…" />
        </div>

        <div className="space-y-2">
          <Label className="font-ui">Message</Label>
          <RichTextEditor value={body} onChange={setBody} placeholder="Write your announcement… Use the link button to add hyperlinks." />
          <p className="font-ui text-xs text-muted-foreground">
            Tip: use <code className="bg-muted px-1 rounded">{'{{first_name}}'}</code> to greet each recipient by name — falls back to "there" if we don't have one on file.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="font-ui">CC (optional)</Label>
          <Input value={cc} onChange={(e) => setCc(e.target.value)} className="font-ui" placeholder="cc@nawe.co.ke, another@nawe.co.ke" />
          <p className="font-ui text-xs text-muted-foreground">Comma-separated. CC'd on every email sent in this broadcast.</p>
        </div>

        <div className="space-y-2">
          <Label className="font-ui">Audience</Label>
          <div className="flex flex-wrap gap-4">
            {ROLE_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 font-ui text-sm text-foreground cursor-pointer">
                <Checkbox checked={roles.includes(opt.value)} onCheckedChange={() => toggleRole(opt.value)} />
                {opt.label}
              </label>
            ))}
            <label className="flex items-center gap-2 font-ui text-sm text-foreground cursor-pointer">
              <Checkbox checked={includeNewsletter} onCheckedChange={(v) => setIncludeNewsletter(v === true)} />
              Newsletter subscribers
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" className="font-ui gap-2" disabled={!audienceSelected || previewing} onClick={handlePreview}>
            <Users className="h-4 w-4" /> {previewing ? 'Counting…' : 'Preview recipient count'}
          </Button>
          {previewCount !== null && (
            <span className="font-ui text-sm text-muted-foreground">This will email <strong className="text-foreground">{previewCount}</strong> {previewCount === 1 ? 'person' : 'people'}.</span>
          )}
        </div>

        <div className="pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="font-ui gap-2" disabled={!canSend || sending}>
                <Megaphone className="h-4 w-4" /> {sending ? 'Sending…' : 'Send broadcast'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Send this broadcast?</AlertDialogTitle>
                <AlertDialogDescription className="font-body">
                  {previewCount !== null
                    ? `This will email ${previewCount} ${previewCount === 1 ? 'person' : 'people'}. This cannot be undone.`
                    : 'This will email everyone matching the selected audience. This cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-ui">Cancel</AlertDialogCancel>
                <AlertDialogAction className="font-ui" onClick={handleSend}>Send</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-xl text-foreground">Send history</h2>
      </div>

      {loadingHistory ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <div className="bg-card rounded-card border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-ui text-xs text-muted-foreground p-4">Subject</th>
                  <th className="text-left font-ui text-xs text-muted-foreground p-4">Audience</th>
                  <th className="text-left font-ui text-xs text-muted-foreground p-4">Sent / Failed</th>
                  <th className="text-left font-ui text-xs text-muted-foreground p-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="p-4 font-display text-sm text-foreground">{h.subject}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {h.audience_roles.map(r => <Badge key={r} variant="outline" className="font-ui text-xs capitalize">{r}</Badge>)}
                        {h.include_newsletter && <Badge variant="outline" className="font-ui text-xs">Newsletter</Badge>}
                      </div>
                      {h.cc_addresses?.length > 0 && (
                        <p className="font-ui text-xs text-muted-foreground mt-1">CC: {h.cc_addresses.join(', ')}</p>
                      )}
                    </td>
                    <td className="p-4 font-ui text-sm text-foreground">{h.recipient_count}{h.failed_count > 0 && <span className="text-destructive"> / {h.failed_count} failed</span>}</td>
                    <td className="p-4 font-ui text-xs text-muted-foreground">{format(new Date(h.sent_at), 'MMM d, yyyy HH:mm')}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center font-body text-muted-foreground">No broadcasts sent yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBroadcast;
