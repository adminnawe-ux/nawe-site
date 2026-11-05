import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, FileX, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { redirectTo } from '@/lib/browser';
import { RESOURCE_BUCKET, isValidResourceSlug } from '@/lib/resources';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'ready'; filename: string; url: string };

// Public download link from broadcast emails: /resource/<slug>.
// get_resource() only answers for an exact slug, so files can't be listed.
const ResourceDownload = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!isValidResourceSlug(slug)) { setState({ kind: 'not-found' }); return; }
    let cancelled = false;
    db.rpc('get_resource', { p_slug: slug })
      .then(({ data }: { data: { original_filename: string }[] | null }) => {
        if (cancelled) return;
        const row = data?.[0];
        if (!row) { setState({ kind: 'not-found' }); return; }
        const { data: { publicUrl } } = supabase.storage.from(RESOURCE_BUCKET)
          .getPublicUrl(slug, { download: row.original_filename });
        setState({ kind: 'ready', filename: row.original_filename, url: publicUrl });
        redirectTo(publicUrl);
      });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="container mx-auto px-4 py-24 max-w-md text-center">
      {state.kind === 'loading' && (
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
      )}
      {state.kind === 'not-found' && (
        <div className="space-y-4">
          <FileX className="h-10 w-10 text-muted-foreground mx-auto" />
          <h1 className="font-display text-2xl text-foreground">File not found</h1>
          <p className="font-body text-muted-foreground">This link may be mistyped, or the file has been removed.</p>
          <Button asChild variant="outline" className="font-ui rounded-full"><Link to="/">Go to homepage</Link></Button>
        </div>
      )}
      {state.kind === 'ready' && (
        <div className="space-y-4">
          <Download className="h-10 w-10 text-primary mx-auto" />
          <h1 className="font-display text-2xl text-foreground">Your download is starting…</h1>
          <p className="font-body text-muted-foreground">If nothing happens, use the button below.</p>
          <Button asChild className="font-ui rounded-full">
            <a href={state.url}>Download {state.filename}</a>
          </Button>
        </div>
      )}
    </div>
  );
};

export default ResourceDownload;
