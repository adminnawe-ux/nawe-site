import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import { format } from 'date-fns';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  tags: string[] | null;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
}

const Blog = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        if (data) setArticles(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl text-foreground mb-3">Wellness Journal</h1>
        <p className="font-body text-lg text-muted-foreground mb-12">Insights, tips, and stories on mental health and well-being.</p>

        {articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-body text-muted-foreground">No articles published yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {articles.map(a => (
              <Link key={a.id} to={`/blog/${a.slug}`} className="block group">
                <article className="bg-card rounded-card p-6 border border-border shadow-card hover:shadow-soft transition-shadow">
                  {a.cover_image_url && (
                    <img src={a.cover_image_url} alt={a.title} className="w-full h-48 object-cover rounded-lg mb-4" />
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="font-ui text-xs">{a.category}</Badge>
                    {a.published_at && (
                      <span className="font-ui text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {format(new Date(a.published_at), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-xl text-foreground group-hover:text-primary transition-colors mb-2">{a.title}</h2>
                  {a.excerpt && <p className="font-body text-muted-foreground line-clamp-2">{a.excerpt}</p>}
                  {a.tags && a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {a.tags.map(t => (
                        <span key={t} className="font-ui text-xs text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" />{t}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const BlogPost = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data }) => {
        setArticle(data);
        setLoading(false);
      });
  }, [slug]);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!article) return (
    <div className="container mx-auto px-6 py-16 text-center">
      <p className="font-display text-2xl text-foreground mb-4">Article not found</p>
      <Link to="/blog"><Button variant="outline" className="font-ui">Back to Blog</Button></Link>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link to="/blog" className="inline-flex items-center gap-1.5 font-ui text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to Journal
        </Link>
        {article.cover_image_url && (
          <img src={article.cover_image_url} alt={article.title} className="w-full h-64 object-cover rounded-card mb-6" />
        )}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="font-ui text-xs">{article.category}</Badge>
          {article.published_at && (
            <span className="font-ui text-xs text-muted-foreground">{format(new Date(article.published_at), 'MMMM d, yyyy')}</span>
          )}
        </div>
        <h1 className="font-display text-3xl text-foreground mb-6">{article.title}</h1>
        <div className="font-body text-foreground leading-relaxed whitespace-pre-wrap">
          {article.content}
        </div>
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
            {article.tags.map(t => <Badge key={t} variant="outline" className="font-ui text-xs">{t}</Badge>)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;
