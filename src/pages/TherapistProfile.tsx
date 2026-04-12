import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Shield, Star, Globe, Video, Phone, MessageCircle,
  MapPin, Calendar, GraduationCap, Clock, Heart, Users
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Therapist = Tables<'therapists'>;

const FORMAT_ICONS: Record<string, React.ElementType> = {
  'Video Call': Video,
  'Phone Call': Phone,
  'Chat / Messaging': MessageCircle,
  'In-Person': MapPin,
};

const TherapistProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [profileName, setProfileName] = useState('');
  const [reviews, setReviews] = useState<Tables<'reviews_public'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessChecked, setAccessChecked] = useState(false);
  const [canViewProfile, setCanViewProfile] = useState(true);

  useEffect(() => {
    if (authLoading || !id) return;

    const checkAccess = async () => {
      if (!user || !roles.includes('therapist')) {
        setCanViewProfile(true);
        setAccessChecked(true);
        return;
      }

      const { data } = await supabase
        .from('therapists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const ownsProfile = data?.id === id;
      setCanViewProfile(ownsProfile);
      setAccessChecked(true);

      if (!ownsProfile) {
        navigate('/therapist-portal/profile-edit', { replace: true });
      }
    };

    checkAccess();
  }, [authLoading, id, navigate, roles, user]);

  useEffect(() => {
    if (!id || !accessChecked || !canViewProfile) return;
    const load = async () => {
      setLoading(true);
      const { data: t } = await supabase.from('therapists').select('*').eq('id', id).maybeSingle();
      setTherapist(t);

      if (t) {
        const [profileRes, reviewRes] = await Promise.all([
          supabase.from('therapist_public_profiles').select('first_name, last_name').eq('user_id', t.user_id).maybeSingle(),
          supabase.from('reviews_public').select('*').eq('therapist_id', t.id).order('created_at', { ascending: false }).limit(10),
        ]);
        setProfileName(`${profileRes.data?.first_name ?? ''} ${profileRes.data?.last_name ?? ''}`.trim());
        setReviews(reviewRes.data ?? []);
      }
      setLoading(false);
    };
    load();
  }, [accessChecked, canViewProfile, id]);

  if (authLoading || (user && roles.includes('therapist') && !accessChecked)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="font-ui text-muted-foreground">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!canViewProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="font-ui text-muted-foreground">Redirecting…</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-10 max-w-4xl space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (!therapist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-display text-2xl text-foreground mb-2">Therapist not found</h2>
          <Button variant="outline" onClick={() => navigate('/matches')} className="font-ui rounded-full mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to directory
          </Button>
        </div>
      </div>
    );
  }

  const t = therapist;
  const displayName = profileName || t.professional_title || 'Therapist';
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6 max-w-4xl">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-ui text-sm transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="md:col-span-1 space-y-6">
            {/* Photo */}
            <div className="relative aspect-[3/4] rounded-card overflow-hidden bg-muted">
              {t.photo_url ? (
                <img src={t.photo_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <span className="font-display text-6xl text-primary/40">{displayName.charAt(0)}</span>
                </div>
              )}
              {t.verified && (
                <div className="absolute top-3 left-3 bg-success/90 text-success-foreground rounded-full px-3 py-1 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  <span className="font-ui text-xs font-medium">Verified</span>
                </div>
              )}
            </div>

            {/* Quick info card */}
            <Card className="rounded-card">
              <CardContent className="p-5 space-y-4">
                {t.price_per_session && (
                  <div className="flex justify-between items-center">
                    <span className="font-ui text-sm text-muted-foreground">Per session</span>
                    <span className="font-display text-lg text-foreground">{t.currency ?? 'KES'} {t.price_per_session.toLocaleString()}</span>
                  </div>
                )}
                {t.sliding_scale && (
                  <div className="flex justify-between items-center">
                    <span className="font-ui text-sm text-muted-foreground">Sliding scale</span>
                    <Badge variant="secondary" className="font-ui text-xs bg-success/10 text-success border-0">Available</Badge>
                  </div>
                )}
                {t.years_experience && (
                  <div className="flex justify-between items-center">
                    <span className="font-ui text-sm text-muted-foreground">Experience</span>
                    <span className="font-ui text-sm text-foreground">{t.years_experience} years</span>
                  </div>
                )}
                {avgRating && (
                  <div className="flex justify-between items-center">
                    <span className="font-ui text-sm text-muted-foreground">Rating</span>
                    <span className="flex items-center gap-1 font-ui text-sm text-foreground">
                      <Star className="h-4 w-4 fill-warning text-warning" /> {avgRating} ({reviews.length})
                    </span>
                  </div>
                )}
                <Separator />
                <Button className="w-full font-ui rounded-full bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                  <Link to={user ? `/book/${t.id}` : '/login'}>
                    <Calendar className="mr-2 h-4 w-4" /> Book a Session
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="md:col-span-2 space-y-8">
            <div>
              <h1 className="font-display text-3xl text-foreground mb-1">{displayName}</h1>
              {t.professional_title && profileName && (
                <p className="font-ui text-sm text-muted-foreground mb-2">{t.professional_title}</p>
              )}
              {t.tagline && (
                <p className="font-body text-base text-muted-foreground italic">"{t.tagline}"</p>
              )}
            </div>

            {/* Bio */}
            {t.bio && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-2">About</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{t.bio}</p>
              </div>
            )}

            {/* Specialisations */}
            {(t.specialisations ?? []).length > 0 && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-3">Specialisations</h3>
                <div className="flex flex-wrap gap-2">
                  {(t.specialisations ?? []).map((s) => (
                    <Badge key={s} variant="outline" className="font-ui text-xs rounded-full px-3 py-1">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Modalities */}
            {(t.modalities ?? []).length > 0 && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-3">Therapeutic Approaches</h3>
                <div className="flex flex-wrap gap-2">
                  {(t.modalities ?? []).map((m) => (
                    <Badge key={m} variant="secondary" className="font-ui text-xs rounded-full px-3 py-1">{m}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Session formats & languages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(t.session_formats ?? []).length > 0 && (
                <div>
                  <h3 className="font-display text-lg text-foreground mb-3">Session Formats</h3>
                  <div className="space-y-2">
                    {(t.session_formats ?? []).map((f) => {
                      const Icon = FORMAT_ICONS[f] ?? Video;
                      return (
                        <div key={f} className="flex items-center gap-2 font-ui text-sm text-muted-foreground">
                          <Icon className="h-4 w-4 text-primary" /> {f}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {(t.languages ?? []).length > 0 && (
                <div>
                  <h3 className="font-display text-lg text-foreground mb-3">Languages</h3>
                  <div className="space-y-2">
                    {(t.languages ?? []).map((l) => (
                      <div key={l} className="flex items-center gap-2 font-ui text-sm text-muted-foreground">
                        <Globe className="h-4 w-4 text-primary" /> {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Education & credentials */}
            {(t.education || t.license_number) && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-3">Credentials</h3>
                <div className="space-y-2">
                  {t.education && (
                    <div className="flex items-start gap-2 font-ui text-sm text-muted-foreground">
                      <GraduationCap className="h-4 w-4 text-primary mt-0.5" /> {t.education}
                    </div>
                  )}
                  {t.license_number && (
                    <div className="flex items-start gap-2 font-ui text-sm text-muted-foreground">
                      <Shield className="h-4 w-4 text-primary mt-0.5" />
                      License: {t.license_number} {t.issuing_body ? `(${t.issuing_body})` : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Client populations */}
            {(t.client_populations ?? []).length > 0 && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-3">Works With</h3>
                <div className="flex flex-wrap gap-2">
                  {(t.client_populations ?? []).map((p) => (
                    <Badge key={p} variant="outline" className="font-ui text-xs rounded-full px-3 py-1">
                      <Users className="mr-1 h-3 w-3" /> {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-4">Reviews</h3>
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <Card key={r.id} className="rounded-card">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-1 mb-2">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? 'fill-warning text-warning' : 'text-muted'}`} />
                          ))}
                          {r.verified && (
                            <Badge variant="secondary" className="ml-2 text-[10px] font-ui bg-success/10 text-success border-0">Verified</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Cancellation policy */}
            {t.cancellation_policy && (
              <div>
                <h3 className="font-display text-lg text-foreground mb-2">Cancellation Policy</h3>
                <p className="font-body text-sm text-muted-foreground">{t.cancellation_policy}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistProfile;
