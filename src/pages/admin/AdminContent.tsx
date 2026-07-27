import { useState, useEffect } from 'react';
import RichTextEditor from '@/components/RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Edit, Trash2, FileText, Send, Upload, X as XIcon,
} from 'lucide-react';
import { format } from 'date-fns';

const CATEGORIES = ['Mental Health', 'Self-Care', 'Relationships', 'Anxiety', 'Depression', 'Wellness Tips', 'General'];

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  tags: string[] | null;
  status: string;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const emptyArticle = {
  title: '', slug: '', excerpt: '', category: 'General',
  tags: '', cover_image_url: '', status: 'draft',
};

// ─── Main page ───────────────────────────────────────────────────────────────

const AdminContent = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyArticle);
  const [editorContent, setEditorContent] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB allowed.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('article-covers').upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('article-covers').getPublicUrl(path);
      setForm(f => ({ ...f, cover_image_url: publicUrl }));
      toast({ title: 'Uploaded', description: 'Cover image ready.' });
    }
    setUploading(false);
  };

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setArticles(data);
    setLoading(false);
  };

  useEffect(() => { fetchArticles(); }, []);

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const openNew = () => {
    setForm(emptyArticle);
    setEditorContent('');
    setEditorKey(k => k + 1);
    setEditId(null);
    setEditing(true);
  };

  const openEdit = (a: Article) => {
    setForm({
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt || '',
      category: a.category,
      tags: (a.tags || []).join(', '),
      cover_image_url: a.cover_image_url || '',
      status: a.status,
    });
    setEditorContent(a.content);
    setEditorKey(k => k + 1);
    setEditId(a.id);
    setEditing(true);
  };

  const handleSave = async (publishNow = false) => {
    if (!form.title.trim() || !editorContent || editorContent === '<p></p>') {
      toast({ title: 'Missing fields', description: 'Title and content are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Fetch the author's display name so the public blog page doesn't need
    // to join profiles (profiles is not readable by anon users)
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', user!.id)
      .maybeSingle();
    const author_name = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null
      : null;

    const slug = form.slug.trim() || slugify(form.title);
    const status = publishNow ? 'published' : form.status;
    const payload = {
      title: form.title.trim(),
      slug,
      excerpt: form.excerpt.trim() || null,
      content: editorContent,
      category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      cover_image_url: form.cover_image_url.trim() || null,
      status,
      author_id: user!.id,
      author_name,
      published_at: status === 'published' ? new Date().toISOString() : null,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('articles').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('articles').insert(payload));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editId ? 'Updated' : 'Created', description: `Article ${status === 'published' ? 'published' : 'saved as draft'}.` });
      setEditing(false);
      fetchArticles();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('articles').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Article removed.' });
      fetchArticles();
    }
  };

  const handleUnpublish = async (id: string) => {
    await supabase.from('articles').update({ status: 'draft', published_at: null }).eq('id', id);
    toast({ title: 'Unpublished', description: 'Article moved to drafts.' });
    fetchArticles();
  };

  const filtered = articles.filter(a => filter === 'all' || a.status === filter);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground mb-2">Content Management</h1>
          <p className="font-body text-muted-foreground">Create and manage articles for the platform.</p>
        </div>
        <Button className="font-ui gap-2" onClick={openNew}><Plus className="h-4 w-4" /> New Article</Button>
      </div>

      {/* Stats & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center">
        <div className="flex gap-3">
          <Badge variant="outline" className="font-ui py-1 px-3">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> {articles.length} Total
          </Badge>
          <Badge className="bg-success/15 text-success border-success/20 font-ui py-1 px-3">
            {articles.filter(a => a.status === 'published').length} Published
          </Badge>
          <Badge className="bg-warning/15 text-warning border-warning/20 font-ui py-1 px-3">
            {articles.filter(a => a.status === 'draft').length} Drafts
          </Badge>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 font-ui"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Articles List */}
      <div className="space-y-3">
        {filtered.map(a => (
          <div key={a.id} className="bg-card rounded-card p-5 border border-border shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-base text-foreground truncate">{a.title}</h3>
                <Badge variant={a.status === 'published' ? 'default' : 'outline'} className="font-ui text-xs shrink-0">
                  {a.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-ui">
                <span>{a.category}</span>
                <span>·</span>
                <span>{format(new Date(a.created_at), 'MMM d, yyyy')}</span>
                {a.published_at && (<><span>·</span><span>Published {format(new Date(a.published_at), 'MMM d')}</span></>)}
              </div>
              {a.excerpt && <p className="font-body text-sm text-muted-foreground mt-1 line-clamp-1">{a.excerpt}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="font-ui gap-1.5" onClick={() => openEdit(a)}>
                <Edit className="h-3.5 w-3.5" /> Edit
              </Button>
              {a.status === 'published' && (
                <Button variant="ghost" size="sm" className="font-ui text-muted-foreground" onClick={() => handleUnpublish(a.id)}>
                  Unpublish
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="font-ui text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">Delete article?</AlertDialogTitle>
                    <AlertDialogDescription className="font-body">This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-ui">Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground font-ui" onClick={() => handleDelete(a.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-card rounded-card p-12 border border-border text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-lg text-foreground mb-1">No articles yet</p>
            <p className="font-body text-sm text-muted-foreground mb-4">Create your first article to share with the community.</p>
            <Button className="font-ui" onClick={openNew}>Create Article</Button>
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editId ? 'Edit Article' : 'New Article'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-ui">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: slugify(e.target.value) })} className="font-ui" placeholder="Article title" />
            </div>
            <div className="space-y-2">
              <Label className="font-ui">Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="font-ui text-xs" placeholder="article-url-slug" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-ui">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="font-ui"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-ui">Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="font-ui" placeholder="therapy, self-care" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-ui">Cover Image</Label>
              {form.cover_image_url ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={form.cover_image_url} alt="Cover" className="w-full h-40 object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, cover_image_url: '' })}
                    className="absolute top-2 right-2 bg-card/90 backdrop-blur-sm rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  {uploading ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                      <span className="font-ui text-xs text-muted-foreground">Click to upload cover image</span>
                      <span className="font-ui text-[10px] text-muted-foreground/60 mt-1">JPG, PNG up to 5MB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
                  />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-ui">Excerpt</Label>
              <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className="font-ui" rows={2} placeholder="Brief summary shown in the blog list…" />
            </div>
            <div className="space-y-2">
              <Label className="font-ui">Content</Label>
              <RichTextEditor key={editorKey} value={editorContent} onChange={setEditorContent} placeholder="Write your article here…" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-ui" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button className="font-ui gap-2" onClick={() => handleSave(true)} disabled={saving}>
              <Send className="h-4 w-4" /> Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminContent;
