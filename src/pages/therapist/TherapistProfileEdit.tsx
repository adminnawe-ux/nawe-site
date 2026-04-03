import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Save, User, Stethoscope, Globe, DollarSign, Settings,
  X, Plus, Loader2, Shield, CalendarClock, Upload, Camera, Check
} from 'lucide-react';
import AvailabilityEditor from '@/components/therapist/AvailabilityEditor';
import type { Tables } from '@/integrations/supabase/types';

const DEFAULT_AVATARS = [
  '/avatars/avatar-1.png',
  '/avatars/avatar-2.png',
  '/avatars/avatar-3.png',
  '/avatars/avatar-4.png',
  '/avatars/avatar-5.png',
  '/avatars/avatar-6.png',
];

type Therapist = Tables<'therapists'>;

const SPECIALISATIONS = [
  'Anxiety', 'Depression', 'Trauma / PTSD', 'Grief & Loss', 'Relationship Issues',
  'Self-Esteem', 'Stress Management', 'Addiction', 'OCD', 'ADHD',
  'Eating Disorders', 'Anger Management', 'Family Conflict', 'Career Counselling',
  'Gender & Sexuality', 'Perinatal Mental Health', 'Chronic Illness', 'Sleep Issues',
];

const MODALITIES = [
  'Cognitive Behavioural Therapy (CBT)', 'Psychodynamic', 'Person-Centred',
  'EMDR', 'Dialectical Behaviour Therapy (DBT)', 'Acceptance & Commitment Therapy (ACT)',
  'Solution-Focused', 'Narrative Therapy', 'Art Therapy', 'Mindfulness-Based',
  'Integrative', 'Gestalt', 'Existential',
];

const SESSION_FORMATS = ['Video Call', 'Phone Call', 'In-Person', 'Chat / Messaging'];
const LANGUAGES = ['English', 'Swahili', 'Kikuyu', 'Luo', 'Kamba', 'French', 'Arabic', 'Somali'];
const CLIENT_POPULATIONS = ['Adults', 'Adolescents', 'Children', 'Couples', 'Families', 'LGBTQ+', 'Elderly'];
const CURRENCIES = ['KES', 'USD', 'GBP', 'EUR'];

const ChipSelect = ({
  options, selected, onChange, label,
}: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string;
}) => (
  <div className="space-y-2">
    <Label className="font-ui text-sm text-foreground">{label}</Label>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])}
            className={`px-3 py-1.5 rounded-full font-ui text-xs border transition-colors ${
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/40'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

const TherapistProfileEdit = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Therapist | null>(null);
  const [customCompetency, setCustomCompetency] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Photo must be under 2MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/photo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    update('photo_url', `${publicUrl}?t=${Date.now()}`);
    toast({ title: 'Photo uploaded', description: 'Remember to save your profile.' });
    setUploading(false);
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('therapists')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setProfile(data);
      setLoading(false);
    };
    load();
  }, [user]);

  const update = <K extends keyof Therapist>(key: K, value: Therapist[K]) =>
    setProfile((prev) => prev ? { ...prev, [key]: value } : prev);

  const clampNum = (val: string, min: number, max: number) => {
    const n = Number(val);
    if (isNaN(n)) return min;
    return Math.max(min, Math.min(max, Math.round(n)));
  };

  const addCompetency = () => {
    const trimmed = customCompetency.trim();
    if (trimmed && profile && !(profile.cultural_competencies ?? []).includes(trimmed)) {
      update('cultural_competencies', [...(profile.cultural_competencies ?? []), trimmed]);
      setCustomCompetency('');
    }
  };

  const validate = (): string | null => {
    if (!profile) return 'No profile loaded.';
    if ((profile.years_experience ?? 0) < 1 || (profile.years_experience ?? 0) > 50) return 'Years of experience must be between 1 and 50.';
    if ((profile.price_per_session ?? 0) < 0) return 'Price per session cannot be negative.';
    if (profile.sliding_scale && (profile.sliding_scale_min ?? 0) < 0) return 'Sliding scale minimum cannot be negative.';
    if (profile.sliding_scale && (profile.sliding_scale_min ?? 0) > (profile.price_per_session ?? 0)) return 'Sliding scale minimum cannot exceed session price.';
    if ((profile.max_sessions_per_day ?? 1) < 1 || (profile.max_sessions_per_day ?? 1) > 20) return 'Max sessions per day must be between 1 and 20.';
    if ((profile.buffer_minutes ?? 5) < 0 || (profile.buffer_minutes ?? 5) > 120) return 'Buffer minutes must be between 0 and 120.';
    return null;
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    const validationError = validate();
    if (validationError) {
      toast({ title: 'Validation error', description: validationError, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('therapists')
      .update({
        professional_title: profile.professional_title,
        license_number: profile.license_number,
        issuing_body: profile.issuing_body,
        education: profile.education,
        years_experience: profile.years_experience,
        bio: profile.bio,
        tagline: profile.tagline,
        specialisations: profile.specialisations,
        modalities: profile.modalities,
        session_formats: profile.session_formats,
        languages: profile.languages,
        client_populations: profile.client_populations,
        cultural_competencies: profile.cultural_competencies,
        price_per_session: profile.price_per_session,
        currency: profile.currency,
        sliding_scale: profile.sliding_scale,
        sliding_scale_min: profile.sliding_scale_min,
        cancellation_policy: profile.cancellation_policy,
        max_sessions_per_day: profile.max_sessions_per_day,
        buffer_minutes: profile.buffer_minutes,
        photo_url: profile.photo_url,
        video_url: profile.video_url,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-display text-xl text-foreground mb-2">No profile found</h2>
        <p className="font-body text-sm text-muted-foreground">Complete onboarding first to create your therapist profile.</p>
      </div>
    );
  }

  const statusColor = profile.verified
    ? 'bg-success/15 text-success border-success/30'
    : profile.verification_status === 'pending'
    ? 'bg-warning/15 text-warning border-warning/30'
    : 'bg-muted text-muted-foreground border-border';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-foreground mb-1">Edit Profile</h1>
          <p className="font-body text-muted-foreground text-sm">Update your professional profile and settings.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`font-ui text-xs ${statusColor}`}>
            <Shield className="h-3 w-3 mr-1" />
            {profile.verified ? 'Verified' : profile.verification_status ?? 'Pending'}
          </Badge>
          <Button onClick={handleSave} disabled={saving} className="font-ui rounded-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="bg-card border border-border rounded-full p-1">
          <TabsTrigger value="personal" className="font-ui text-xs rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User className="h-3.5 w-3.5 mr-1.5" /> Personal
          </TabsTrigger>
          <TabsTrigger value="clinical" className="font-ui text-xs rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Stethoscope className="h-3.5 w-3.5 mr-1.5" /> Clinical
          </TabsTrigger>
          <TabsTrigger value="sessions" className="font-ui text-xs rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Globe className="h-3.5 w-3.5 mr-1.5" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="pricing" className="font-ui text-xs rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Pricing
          </TabsTrigger>
          <TabsTrigger value="scheduling" className="font-ui text-xs rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Settings className="h-3.5 w-3.5 mr-1.5" /> Scheduling
          </TabsTrigger>
        </TabsList>

        <div className="bg-card rounded-[var(--radius-card)] border border-border p-6 sm:p-8 shadow-[var(--shadow-card)]">
          {/* Personal */}
          <TabsContent value="personal" className="mt-0 space-y-5">
            <div className="space-y-2">
              <Label className="font-ui text-sm">Professional Title</Label>
              <Input
                value={profile.professional_title ?? ''}
                onChange={(e) => update('professional_title', e.target.value)}
                className="rounded-full"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-ui text-sm">License Number</Label>
                <Input
                  value={profile.license_number ?? ''}
                  onChange={(e) => update('license_number', e.target.value)}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-ui text-sm">Issuing Body</Label>
                <Input
                  value={profile.issuing_body ?? ''}
                  onChange={(e) => update('issuing_body', e.target.value)}
                  className="rounded-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm">Education</Label>
              <Textarea
                value={profile.education ?? ''}
                onChange={(e) => update('education', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm">Years of Experience</Label>
              <Input
                type="number"
                value={profile.years_experience ?? 1}
                onChange={(e) => update('years_experience', Number(e.target.value))}
                onBlur={(e) => update('years_experience', clampNum(e.target.value, 1, 50))}
                min={1}
                max={50}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm">Tagline</Label>
              <Input
                value={profile.tagline ?? ''}
                onChange={(e) => update('tagline', e.target.value)}
                maxLength={120}
                className="rounded-full"
              />
              <p className="font-ui text-[10px] text-muted-foreground">{(profile.tagline ?? '').length}/120 characters</p>
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm">Bio</Label>
              <Textarea
                value={profile.bio ?? ''}
                onChange={(e) => update('bio', e.target.value)}
                rows={5}
              />
            </div>

            {/* Photo Upload Section */}
            <div className="space-y-4">
              <Label className="font-ui text-sm">Profile Photo</Label>
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                    {profile.photo_url ? (
                      <img src={profile.photo_url} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center"
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-ui text-xs rounded-full gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-3 w-3" /> Upload Photo
                </Button>
              </div>

              {/* Default avatars */}
              <div className="space-y-2">
                <p className="font-ui text-xs text-muted-foreground">Or choose an avatar:</p>
                <div className="flex gap-3 flex-wrap">
                  {DEFAULT_AVATARS.map((av, i) => {
                    const isSelected = profile.photo_url === av;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => update('photo_url', av)}
                        className={`relative h-14 w-14 rounded-full overflow-hidden border-2 transition-all hover:scale-105 ${
                          isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <img src={av} alt={`Avatar ${i + 1}`} className="h-full w-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-ui text-sm">Video Introduction URL</Label>
              <Input
                value={profile.video_url ?? ''}
                onChange={(e) => update('video_url', e.target.value)}
                placeholder="https://..."
                className="rounded-full"
              />
            </div>
          </TabsContent>

          {/* Clinical */}
          <TabsContent value="clinical" className="mt-0 space-y-6">
            <ChipSelect
              label="Specialisations"
              options={SPECIALISATIONS}
              selected={profile.specialisations ?? []}
              onChange={(v) => update('specialisations', v)}
            />
            <ChipSelect
              label="Therapeutic Modalities"
              options={MODALITIES}
              selected={profile.modalities ?? []}
              onChange={(v) => update('modalities', v)}
            />
          </TabsContent>

          {/* Sessions */}
          <TabsContent value="sessions" className="mt-0 space-y-6">
            <ChipSelect
              label="Session Formats Offered"
              options={SESSION_FORMATS}
              selected={profile.session_formats ?? []}
              onChange={(v) => update('session_formats', v)}
            />
            <ChipSelect
              label="Languages"
              options={LANGUAGES}
              selected={profile.languages ?? []}
              onChange={(v) => update('languages', v)}
            />
            <ChipSelect
              label="Client Populations"
              options={CLIENT_POPULATIONS}
              selected={profile.client_populations ?? []}
              onChange={(v) => update('client_populations', v)}
            />
            <div className="space-y-2">
              <Label className="font-ui text-sm">Cultural Competencies</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Kenyan, East African, Muslim communities"
                  value={customCompetency}
                  onChange={(e) => setCustomCompetency(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCompetency())}
                  className="rounded-full"
                />
                <Button type="button" size="icon" variant="outline" onClick={addCompetency} className="rounded-full shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {(profile.cultural_competencies ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(profile.cultural_competencies ?? []).map((c) => (
                    <Badge key={c} variant="secondary" className="font-ui text-xs gap-1">
                      {c}
                      <button onClick={() => update('cultural_competencies', (profile.cultural_competencies ?? []).filter((x) => x !== c))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Pricing */}
          <TabsContent value="pricing" className="mt-0 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-ui text-sm">Price per Session</Label>
                <Input
                  type="number"
                  value={profile.price_per_session ?? 0}
                  onChange={(e) => update('price_per_session', Number(e.target.value))}
                  onBlur={(e) => update('price_per_session', clampNum(e.target.value, 0, 1000000))}
                  min={0}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-ui text-sm">Currency</Label>
                <Select value={profile.currency ?? 'KES'} onValueChange={(v) => update('currency', v)}>
                  <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={profile.sliding_scale ?? false}
                onCheckedChange={(v) => update('sliding_scale', v)}
              />
              <Label className="font-ui text-sm">Offer sliding scale pricing</Label>
            </div>
            {profile.sliding_scale && (
              <div className="space-y-2">
                <Label className="font-ui text-sm">Minimum sliding scale fee ({profile.currency ?? 'KES'})</Label>
                <Input
                  type="number"
                  value={profile.sliding_scale_min ?? 0}
                  onChange={(e) => update('sliding_scale_min', Number(e.target.value))}
                  onBlur={(e) => update('sliding_scale_min', clampNum(e.target.value, 0, profile.price_per_session ?? 1000000))}
                  min={0}
                  className="rounded-full"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="font-ui text-sm">Cancellation Policy</Label>
              <Select value={profile.cancellation_policy ?? '24 hours'} onValueChange={(v) => update('cancellation_policy', v)}>
                <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24 hours">24-hour notice required</SelectItem>
                  <SelectItem value="48 hours">48-hour notice required</SelectItem>
                  <SelectItem value="Flexible">Flexible — no penalty</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Scheduling */}
          <TabsContent value="scheduling" className="mt-0 space-y-6">
            <div className="space-y-2">
              <Label className="font-ui text-sm">Max Sessions per Day</Label>
              <Input
                type="number"
                value={profile.max_sessions_per_day ?? 8}
                onChange={(e) => update('max_sessions_per_day', Number(e.target.value))}
                onBlur={(e) => update('max_sessions_per_day', clampNum(e.target.value, 1, 20))}
                min={1}
                max={20}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-ui text-sm">Buffer Between Sessions (minutes)</Label>
              <Input
                type="number"
                value={profile.buffer_minutes ?? 15}
                onChange={(e) => update('buffer_minutes', Number(e.target.value))}
                onBlur={(e) => update('buffer_minutes', clampNum(e.target.value, 0, 120))}
                min={0}
                max={120}
                step={5}
                className="rounded-full"
              />
            </div>

            <div className="border-t border-border pt-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="h-4 w-4 text-primary" />
                <Label className="font-display text-base">Weekly Availability</Label>
              </div>
              <AvailabilityEditor therapistId={profile.id} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default TherapistProfileEdit;
