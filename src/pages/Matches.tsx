import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatTherapistDisplayName } from '@/lib/therapist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Search, MapPin, Globe, Video, Phone, MessageCircle,
  SlidersHorizontal, Heart, Shield, X, Users
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Therapist = Tables<'therapists'>;
type IntakeResponse = Tables<'intake_responses'>;

interface ScoredTherapist extends Therapist {
  matchScore: number;
  matchReasons: string[];
  profileName?: string;
  profileAvatar?: string;
}

const FORMAT_ICONS: Record<string, React.ElementType> = {
  'Video Call': Video,
  'Phone Call': Phone,
  'Chat / Messaging': MessageCircle,
  'In-Person': MapPin,
};

const QUESTIONNAIRE_DRAFT_KEY = 'nawe_questionnaire_draft';

function buildGuestIntakeFromDraft(): IntakeResponse | null {
  const saved = localStorage.getItem(QUESTIONNAIRE_DRAFT_KEY);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as { data?: Record<string, unknown> };
    const data = parsed.data ?? {};

    return {
      id: '',
      user_id: '',
      age_range: (data.age_range as string) ?? '',
      gender_identity: (data.gender_identity as string) ?? '',
      presenting_concerns: (data.presenting_concerns as string[]) ?? [],
      session_format_preference: (data.session_format_preference as string[]) ?? [],
      language_preference: (data.language_preference as string) ?? 'English',
      session_time_preference: (data.session_time_preference as string) ?? '',
      frequency_preference: (data.frequency_preference as string) ?? '',
      therapist_gender_preference: (data.therapist_gender_preference as string) ?? '',
      cultural_background_important: Boolean(data.cultural_background_important),
      cultural_background: (data.cultural_background as string) ?? '',
      experience_level_preference: (data.experience_level_preference as string) ?? '',
      specialisation_importance: Number(data.specialisation_importance ?? 3),
      budget_range: (data.budget_range as string) ?? '',
      insurance_coverage: (data.insurance_coverage as string) ?? '',
      sliding_scale_needed: Boolean(data.sliding_scale_needed),
      additional_notes: (data.additional_notes as string) ?? '',
      previous_therapy: data.previous_therapy as boolean | null,
      crisis_flag: Boolean(data.crisis_flag),
      completed: false,
      created_at: '',
      updated_at: '',
    } as IntakeResponse;
  } catch {
    return null;
  }
}

function computeMatchScore(therapist: Therapist, intake: IntakeResponse | null): { score: number; reasons: string[] } {
  if (!intake) return { score: 0, reasons: [] };
  let score = 0;
  const reasons: string[] = [];

  // Specialisation match
  const concerns = intake.presenting_concerns ?? [];
  const specs = therapist.specialisations ?? [];
  const specOverlap = concerns.filter((c) => specs.some((s) => s.toLowerCase().includes(c.toLowerCase()))).length;
  if (specOverlap > 0) {
    score += Math.min(specOverlap * 10, 30);
    reasons.push('Specialises in your concerns');
  }

  // Session format match
  const prefFormats = intake.session_format_preference ?? [];
  const tFormats = therapist.session_formats ?? [];
  if (prefFormats.some((f) => tFormats.includes(f))) {
    score += 15;
    reasons.push('Offers your preferred format');
  }

  // Language match
  const lang = intake.language_preference ?? 'English';
  if ((therapist.languages ?? []).some((l) => l.toLowerCase() === lang.toLowerCase())) {
    score += 15;
    reasons.push(`Speaks ${lang}`);
  }

  // Gender preference
  const genderPref = intake.therapist_gender_preference;
  if (genderPref && genderPref !== 'No preference') {
    // We don't have therapist gender in the table, so skip scoring but don't penalise
  }

  // Budget match
  const budget = intake.budget_range;
  const price = therapist.price_per_session;
  if (budget && price) {
    const budgetMax: Record<string, number> = {
      'Under 2,000': 2000,
      '2,000–5,000': 5000,
      '5,000–10,000': 10000,
      '10,000+': 999999,
    };
    const max = budgetMax[budget];
    if (max && price <= max) {
      score += 15;
      reasons.push('Within your budget');
    }
  }

  // Sliding scale
  if (intake.sliding_scale_needed && therapist.sliding_scale) {
    score += 10;
    reasons.push('Offers sliding scale');
  }

  // Cultural competency
  if (intake.cultural_background_important) {
    const cultural = therapist.cultural_competencies ?? [];
    if (cultural.length > 0) {
      score += 10;
      reasons.push('Culturally competent');
    }
  }

  // Experience level
  const expPref = intake.experience_level_preference;
  if (expPref && expPref !== 'No preference' && therapist.years_experience) {
    if (expPref === 'Early-career (1–3 yrs)' && therapist.years_experience <= 3) {
      score += 5;
    } else if (expPref === 'Experienced (4–10 yrs)' && therapist.years_experience >= 4) {
      score += 5;
    }
  }

  return { score: Math.min(score, 100), reasons };
}

const Matches = () => {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState<ScoredTherapist[]>([]);
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [priceSort, setPriceSort] = useState('match');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (roles.includes('therapist')) return;

    const load = async () => {
      setLoading(true);

      // Fetch intake if logged in
      let intakeData: IntakeResponse | null = null;
      if (user) {
        const { data } = await supabase
          .from('intake_responses')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        intakeData = data;
        setIntake(data);
      } else {
        intakeData = buildGuestIntakeFromDraft();
        setIntake(intakeData);
      }

      // Fetch verified therapists with profile names
      const { data: therapistRows } = await supabase
        .from('therapists')
        .select('*')
        .eq('verified', true);

      if (therapistRows) {
        // Fetch profile names for therapists
        const userIds = therapistRows.map((t) => t.user_id);
        const { data: profiles } = await supabase
          .from('therapist_public_profiles')
          .select('user_id, first_name, last_name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(
          (profiles ?? []).map((p) => [p.user_id, { firstName: p.first_name, lastName: p.last_name, avatar: p.avatar_url }])
        );

        const scored: ScoredTherapist[] = therapistRows.map((t) => {
          const { score, reasons } = computeMatchScore(t, intakeData);
          const profile = profileMap.get(t.user_id);
          return {
            ...t,
            matchScore: score,
            matchReasons: reasons,
            profileName: profile ? formatTherapistDisplayName(profile.firstName, profile.lastName) : undefined,
            profileAvatar: profile?.avatar || undefined,
          };
        });

        scored.sort((a, b) => b.matchScore - a.matchScore);
        setTherapists(scored);
      }

      setLoading(false);
    };

    load();
  }, [roles, user]);

  const filtered = useMemo(() => {
    let result = [...therapists];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          (t.profileName ?? '').toLowerCase().includes(q) ||
          (t.professional_title ?? '').toLowerCase().includes(q) ||
          (t.specialisations ?? []).some((s) => s.toLowerCase().includes(q)) ||
          (t.bio ?? '').toLowerCase().includes(q)
      );
    }

    if (formatFilter !== 'all') {
      result = result.filter((t) => (t.session_formats ?? []).includes(formatFilter));
    }

    if (priceSort === 'low') result.sort((a, b) => (a.price_per_session ?? 0) - (b.price_per_session ?? 0));
    else if (priceSort === 'high') result.sort((a, b) => (b.price_per_session ?? 0) - (a.price_per_session ?? 0));
    // 'match' keeps the default matchScore sorting

    return result;
  }, [therapists, search, formatFilter, priceSort]);

  const visibleTherapists = filtered.slice(0, 3);

  useEffect(() => {
    if (roles.includes('therapist')) {
      navigate('/therapist-portal/profile-edit', { replace: true });
    }
  }, [navigate, roles]);

  if (roles.includes('therapist')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="font-ui text-muted-foreground">Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-ui text-sm transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="font-display text-3xl md:text-4xl text-foreground mb-2">
            {intake ? 'Your Matches' : 'Therapist Directory'}
          </h1>
          <p className="font-body text-muted-foreground max-w-xl">
            {intake
              ? "Based on your questionnaire, here are therapists we think would be a great fit for you."
              : "Browse our directory of verified, licensed therapists. Take the questionnaire for personalised matches."}
          </p>
          {!intake && user && (
            <Link to="/questionnaire">
              <Button className="mt-4 font-ui rounded-full" size="sm">
                <Heart className="mr-2 h-4 w-4" /> Take the Questionnaire
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, specialisation, or keyword…"
              className="pl-10 rounded-full"
              maxLength={100}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="font-ui rounded-full">
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 flex flex-wrap gap-3 p-4 bg-card rounded-card border border-border animate-fade-in">
            <div className="space-y-1">
              <label className="font-ui text-xs text-muted-foreground">Session Format</label>
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="w-[160px] text-sm rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  <SelectItem value="Video Call">Video Call</SelectItem>
                  <SelectItem value="Phone Call">Phone Call</SelectItem>
                  <SelectItem value="In-Person">In-Person</SelectItem>
                  <SelectItem value="Chat / Messaging">Chat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="font-ui text-xs text-muted-foreground">Sort By</label>
              <Select value={priceSort} onValueChange={setPriceSort}>
                <SelectTrigger className="w-[160px] text-sm rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">Best Match</SelectItem>
                  <SelectItem value="low">Price: Low → High</SelectItem>
                  <SelectItem value="high">Price: High → Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFormatFilter('all'); setPriceSort('match'); setSearch(''); }} className="font-ui text-xs self-end">
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          </div>
        )}

        <p className="font-ui text-xs text-muted-foreground mt-4">
          {loading
            ? 'Loading…'
            : filtered.length > visibleTherapists.length
              ? `Showing top ${visibleTherapists.length} of ${filtered.length} therapist${filtered.length === 1 ? '' : 's'}`
              : `${visibleTherapists.length} therapist${visibleTherapists.length === 1 ? '' : 's'} found`}
        </p>
      </div>

      {/* Results */}
      <div className="container mx-auto px-6 pb-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="rounded-card overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-5 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display text-xl text-foreground mb-2">No therapists found</h3>
            <p className="font-body text-sm text-muted-foreground mb-6">
              {search ? 'Try adjusting your search or filters.' : 'New therapists are joining every day. Check back soon!'}
            </p>
            {search && (
              <Button variant="outline" onClick={() => setSearch('')} className="font-ui rounded-full">
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTherapists.map((t) => (
              <TherapistCard key={t.id} therapist={t} hasIntake={!!intake} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TherapistCard = ({ therapist: t, hasIntake }: { therapist: ScoredTherapist; hasIntake: boolean }) => {
  const displayName = t.profileName || t.professional_title || 'Therapist';
  const photoUrl = t.photo_url || t.profileAvatar;
  const formats = t.session_formats ?? [];
  const specs = (t.specialisations ?? []).slice(0, 4);

  return (
    <Link to={`/therapist/${t.id}`}>
      <Card className="rounded-card overflow-hidden border-border hover:shadow-soft transition-shadow group h-full flex flex-col">
        {/* Photo / placeholder */}
        <div className="relative h-48 bg-muted overflow-hidden">
          {photoUrl ? (
            <img src={photoUrl} alt={displayName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <span className="font-display text-4xl text-primary/40">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {t.verified && (
            <div className="absolute top-3 left-3 bg-success/90 text-success-foreground rounded-full px-2.5 py-0.5 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span className="font-ui text-[10px] font-medium">Verified</span>
            </div>
          )}
        </div>

        <CardContent className="p-5 flex flex-col flex-1">
          <h3 className="font-display text-lg text-foreground mb-0.5">{displayName}</h3>
          {t.professional_title && t.profileName && (
            <p className="font-ui text-xs text-muted-foreground mb-2">{t.professional_title}</p>
          )}
          {t.tagline && (
            <p className="font-body text-sm text-muted-foreground mb-3 line-clamp-2 italic">"{t.tagline}"</p>
          )}

          {/* Match reasons */}
          {hasIntake && t.matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {t.matchReasons.slice(0, 3).map((r) => (
                <Badge key={r} variant="secondary" className="text-[10px] font-ui bg-primary/10 text-primary border-0">
                  {r}
                </Badge>
              ))}
            </div>
          )}

          {/* Specialisations */}
          {specs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {specs.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px] font-ui">
                  {s}
                </Badge>
              ))}
              {(t.specialisations ?? []).length > 4 && (
                <Badge variant="outline" className="text-[10px] font-ui">
                  +{(t.specialisations ?? []).length - 4}
                </Badge>
              )}
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {formats.slice(0, 3).map((f) => {
                const Icon = FORMAT_ICONS[f];
                return Icon ? <Icon key={f} className="h-4 w-4 text-muted-foreground" /> : null;
              })}
              {(t.languages ?? []).length > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="font-ui text-[10px]">{(t.languages ?? []).join(', ')}</span>
                </span>
              )}
            </div>
            {t.price_per_session && (
              <span className="font-ui text-sm font-semibold text-foreground">
                {t.currency ?? 'KES'} {t.price_per_session.toLocaleString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default Matches;
