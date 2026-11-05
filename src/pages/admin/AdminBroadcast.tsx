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
import { Megaphone, Users, History, Paperclip, X, Copy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { APP_URL } from '@/lib/site';
import {
  MAX_RESOURCES_PER_BROADCAST, RESOURCE_ACCEPT, RESOURCE_BUCKET, formatBytes,
  makeResourceSlug, mimeTypeForFilename, resourceUrl, validateResourceFile,
} from '@/lib/resources';

// `resources` isn't in the generated Database types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
  resource_ids: string[] | null;
  event_id: string | null;
}

interface EventOption {
  id: string;
  title: string;
  starts_at: string;
}

interface Attachment {
  id: string;
  slug: string;
  original_filename: string;
  size_bytes: number;
}

const AdminBroadcast = () => {
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [cc, setCc] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [includeNewsletter, setIncludeNewsletter] = useState(false);
  const [includeEventAttendees, setIncludeEventAttendees] = useState(false);
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState<EventOption[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<BroadcastSend[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [historyFileNames, setHistoryFileNames] = useState<Record<string, string>>({});

  const eventAudience = includeEventAttendees && eventId ? eventId : null;
  const audienceSelected = roles.length > 0 || includeNewsletter || !!eventAudience;
  const canSend = subject.trim() && body && body !== '<p></p>' && audienceSelected;

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('broadcast_sends')
      .select('id, subject, audience_roles, include_newsletter, cc_addresses, recipient_count, failed_count, sent_at, resource_ids, event_id')
      .order('sent_at', { ascending: false })
      .limit(20);
    const rows = (data ?? []) as BroadcastSend[];
    setHistory(rows);
    setLoadingHistory(false);

    const ids = [...new Set(rows.flatMap(h => h.resource_ids ?? []))];
    if (ids.length > 0) {
      const { data: files } = await db.from('resources').select('id, original_filename').in('id', ids);
      setHistoryFileNames(Object.fromEntries(
        ((files ?? []) as { id: string; original_filename: string }[]).map(f => [f.id, f.original_filename]),
      ));
    }
  };

  // Each file is stored under a random-prefixed slug and recorded in `resources`;
  // send-broadcast turns the ids into /resource/<slug> download links.
  const handleFiles = async (files: File[]) => {
    setUploading(true);
    let count = attachments.length;
    for (const file of files) {
      const invalid = validateResourceFile(file);
      if (invalid) {
        toast({ title: 'File not attached', description: invalid, variant: 'destructive' });
        continue;
      }
      if (count >= MAX_RESOURCES_PER_BROADCAST) {
        toast({ title: `You can attach up to ${MAX_RESOURCES_PER_BROADCAST} files`, variant: 'destructive' });
        break;
      }
      const slug = makeResourceSlug(file.name);
      const mimeType = mimeTypeForFilename(file.name)!;
      const storage = supabase.storage.from(RESOURCE_BUCKET);
      const { error: uploadError } = await storage.upload(slug, file, { contentType: mimeType, upsert: false });
      if (uploadError) {
        toast({ title: `Upload failed: ${file.name}`, variant: 'destructive' });
        continue;
      }
      const { data: row, error: insertError } = await db.from('resources')
        .insert({ slug, original_filename: file.name, mime_type: mimeType, size_bytes: file.size })
        .select('id, slug, original_filename, size_bytes')
        .single();
      if (insertError || !row) {
        await storage.remove([slug]);
        toast({ title: `Upload failed: ${file.name}`, variant: 'destructive' });
        continue;
      }
      count++;
      setAttachments(prev => [...prev, row as Attachment]);
    }
    setUploading(false);
  };

  const removeAttachment = async (a: Attachment) => {
    setAttachments(prev => prev.filter(x => x.id !== a.id));
    await db.from('resources').delete().eq('id', a.id);
    await supabase.storage.from(RESOURCE_BUCKET).remove([a.slug]);
  };

  const copyLink = async (a: Attachment) => {
    try {
      await navigator.clipboard.writeText(resourceUrl(a.slug, APP_URL));
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Could not copy link', variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchHistory();
    db.from('events').select('id, title, starts_at').order('starts_at', { ascending: false }).limit(50)
      .then(({ data }: { data: EventOption[] | null }) => setEvents(data ?? []));
  }, []);

  // Any change to the audience invalidates the last preview count.
  useEffect(() => { setPreviewCount(null); }, [roles, includeNewsletter, eventAudience]);

  const toggleRole = (role: string) =>
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const invokeSendBroadcast = async (preview: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession();
    return supabase.functions.invoke('send-broadcast', {
      body: {
        subject, body, roles, include_newsletter: includeNewsletter, cc, preview,
        resource_ids: attachments.map(a => a.id),
        event_id: eventAudience ?? undefined,
      },
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
      setIncludeEventAttendees(false);
      setEventId('');
      setPreviewCount(null);
      setAttachments([]);
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
          <Label className="font-ui">Files (optional)</Label>
          {attachments.length > 0 && (
            <ul className="space-y-2">
              {attachments.map(a => (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-sm text-foreground truncate">{a.original_filename}</p>
                    <p className="font-ui text-xs text-muted-foreground truncate">
                      {formatBytes(a.size_bytes)} · <span>{resourceUrl(a.slug, APP_URL)}</span>
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Copy link for ${a.original_filename}`} onClick={() => copyLink(a)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${a.original_filename}`} onClick={() => removeAttachment(a)}>
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-3">
            <input
              id="broadcast-files" type="file" multiple accept={RESOURCE_ACCEPT} className="sr-only"
              disabled={uploading || attachments.length >= MAX_RESOURCES_PER_BROADCAST}
              onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) handleFiles(files); }}
            />
            <Button type="button" variant="outline" className="font-ui gap-2" asChild
              disabled={uploading || attachments.length >= MAX_RESOURCES_PER_BROADCAST}>
              <label htmlFor="broadcast-files" className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                {uploading ? 'Uploading…' : 'Attach files'}
              </label>
            </Button>
          </div>
          <p className="font-ui text-xs text-muted-foreground">
            Up to {MAX_RESOURCES_PER_BROADCAST} files, 25 MB each (PDF, PowerPoint, Word, Excel, PNG, JPG). Each email gets a download link. Anyone with the link can download the file.
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
            <label className="flex items-center gap-2 font-ui text-sm text-foreground cursor-pointer">
              <Checkbox checked={includeEventAttendees} onCheckedChange={(v) => setIncludeEventAttendees(v === true)} />
              Event attendees
            </label>
          </div>
          {includeEventAttendees && (
            <div className="space-y-1.5 pt-1">
              <label htmlFor="broadcast-event" className="font-ui text-xs text-muted-foreground">Event</label>
              <select
                id="broadcast-event" value={eventId} onChange={(e) => setEventId(e.target.value)}
                className="w-full max-w-md font-ui text-sm border border-input rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Choose an event…</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title} — {format(new Date(ev.starts_at), 'd MMM yyyy')}</option>
                ))}
              </select>
              <p className="font-ui text-xs text-muted-foreground">
                Everyone with a confirmed ticket (free or paid), including group members. {'{{first_name}}'} uses the first word of the name they registered with.
              </p>
            </div>
          )}
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
                        {h.event_id && (
                          <Badge variant="outline" className="font-ui text-xs">
                            Attendees: {events.find(ev => ev.id === h.event_id)?.title ?? 'event'}
                          </Badge>
                        )}
                      </div>
                      {h.cc_addresses?.length > 0 && (
                        <p className="font-ui text-xs text-muted-foreground mt-1">CC: {h.cc_addresses.join(', ')}</p>
                      )}
                      {(h.resource_ids?.length ?? 0) > 0 && (
                        <p className="font-ui text-xs text-muted-foreground mt-1">
                          Files: {h.resource_ids!.map(id => historyFileNames[id] ?? 'deleted file').join(', ')}
                        </p>
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
