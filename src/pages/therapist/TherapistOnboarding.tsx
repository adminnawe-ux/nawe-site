import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, ArrowRight, Check, User, Stethoscope, Globe, DollarSign, Settings,
  X, Plus, Loader2, FileText, UploadCloud,
} from 'lucide-react';

const STEPS = [
  { icon: User, label: 'Personal Info', description: 'Your professional identity' },
  { icon: Stethoscope, label: 'Clinical Details', description: 'Your expertise & approach' },
  { icon: Globe, label: 'Session Setup', description: 'Formats, languages & populations' },
  { icon: DollarSign, label: 'Pricing', description: 'Fees & financial policies' },
  { icon: Settings, label: 'Preferences', description: 'Scheduling & final details' },
  { icon: FileText, label: 'Documents', description: 'CV & cover letter' },
];

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
const THERAPIST_ONBOARDING_FLAG = 'nawe_pending_therapist_onboarding';

interface OnboardingData {
  professional_title: string;
  license_number: string;
  issuing_body: string;
  education: string;
  years_experience: number;
  gender: string;
  bio: string;
  tagline: string;
  specialisations: string[];
  modalities: string[];
  session_formats: string[];
  languages: string[];
  client_populations: string[];
  cultural_competencies: string[];
  price_per_session: number;
  currency: string;
  sliding_scale: boolean;
  sliding_scale_min: number;
  cancellation_policy: string;
  max_sessions_per_day: number;
  buffer_minutes: number;
}

const defaultData: OnboardingData = {
  professional_title: '',
  license_number: '',
  issuing_body: '',
  gender: '',
  education: '',
  years_experience: 1,
  bio: '',
  tagline: '',
  specialisations: [],
  modalities: [],
  session_formats: [],
  languages: ['English'],
  client_populations: ['Adults'],
  cultural_competencies: [],
  price_per_session: 3000,
  currency: 'KES',
  sliding_scale: false,
  sliding_scale_min: 1000,
  cancellation_policy: '24 hours',
  max_sessions_per_day: 8,
  buffer_minutes: 15,
};

const clampNum = (val: string, min: number, max: number) => {
  const n = Number(val);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
};

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

const ACCEPTED_CV_TYPES = '.pdf,.doc,.docx';
const MAX_CV_BYTES = 5 * 1024 * 1024;

const TherapistOnboarding = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [saving, setSaving] = useState(false);
  const [customCompetency, setCustomCompetency] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, navigate, user]);

  const addCompetency = () => {
    const trimmed = customCompetency.trim();
    if (trimmed && !data.cultural_competencies.includes(trimmed)) {
      update('cultural_competencies', [...data.cultural_competencies, trimmed]);
      setCustomCompetency('');
    }
  };

  const handleCvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CV_BYTES) {
      toast({ title: 'File too large', description: 'Maximum size is 5 MB.', variant: 'destructive' });
      return;
    }
    setCvFile(file);
    setCvUrl(null);
  };

  const handleCvUpload = async () => {
    if (!cvFile || !user) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const ext = cvFile.name.split('.').pop()?.toLowerCase() ?? 'pdf';
      const timestamp = Date.now();
      const path = `${user.id}/${timestamp}_cv.${ext}`;

      // Simulate progress (Supabase JS v2 doesn't stream upload progress)
      const ticker = setInterval(() => setUploadProgress((p) => Math.min(p + 15, 85)), 200);

      const { error: uploadError } = await supabase.storage
        .from('therapist-cvs')
        .upload(path, cvFile);

      clearInterval(ticker);

      if (uploadError) throw uploadError;

      setUploadProgress(100);
      setCvUrl(path);
      toast({ title: 'CV uploaded', description: cvFile.name });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Add therapist role if not present
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'therapist');

      if (!roles || roles.length === 0) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'therapist' as const });
        if (roleError) throw roleError;
      }

      // If therapist already has a cv_url, archive it to history before overwriting
      if (cvUrl) {
        const { data: existing } = await supabase
          .from('therapists')
          .select('id, cv_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing?.cv_url && existing.cv_url !== cvUrl) {
          await supabase.from('therapist_cv_history').insert({
            therapist_id: existing.id,
            cv_url: existing.cv_url,
          });
        }
      }

      // Upsert therapist record after the role exists so the DB trigger allows it.
      const { error: tError } = await supabase.from('therapists').upsert(
        {
          user_id: user.id,
          ...data,
          cv_url: cvUrl,
          verification_status: 'pending',
          verified: false,
        },
        { onConflict: 'user_id' }
      );
      if (tError) throw tError;

      localStorage.removeItem(THERAPIST_ONBOARDING_FLAG);

      // Notify admin of new application (best-effort)
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      supabase.functions.invoke('therapist-application-notify', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }).catch((err) => console.error('Admin notification failed:', err));

      toast({ title: 'Application submitted!', description: 'Your profile is under review. We will notify you once approved.' });
      navigate('/therapist-portal');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl text-foreground">Therapist Onboarding</h1>
            <p className="font-ui text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
          </div>
          <button onClick={() => navigate('/')} className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors">
            Save & Exit
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-border'
                }`}
              />
              <span className={`font-ui text-[10px] hidden sm:block ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h2 className="font-display text-2xl text-foreground mb-1">{STEPS[step].label}</h2>
            <p className="font-body text-muted-foreground text-sm">{STEPS[step].description}</p>
          </div>

          <div className="bg-card rounded-[var(--radius-card)] border border-border p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label className="font-ui text-sm">Professional Title</Label>
                  <Input
                    placeholder="e.g. Clinical Psychologist, Counselling Psychologist"
                    value={data.professional_title}
                    onChange={(e) => update('professional_title', e.target.value)}
                    className="rounded-full"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-ui text-sm">License Number</Label>
                    <Input
                      placeholder="e.g. KCP/2024/1234"
                      value={data.license_number}
                      onChange={(e) => update('license_number', e.target.value)}
                      className="rounded-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-ui text-sm">Issuing Body</Label>
                    <Input
                      placeholder="e.g. Kenya Counselling & Psychological Association"
                      value={data.issuing_body}
                      onChange={(e) => update('issuing_body', e.target.value)}
                      className="rounded-full"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-ui text-sm">Education</Label>
                  <Textarea
                    placeholder="Your academic qualifications, e.g. MSc Clinical Psychology, University of Nairobi"
                    value={data.education}
                    onChange={(e) => update('education', e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-ui text-sm">Years of Experience</Label>
                  <Input
                    type="number"
                    value={data.years_experience}
                    onChange={(e) => update('years_experience', Number(e.target.value))}
                    onBlur={(e) => update('years_experience', clampNum(e.target.value, 1, 50))}
                    min={1}
                    max={50}
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-ui text-sm">Gender</Label>
                  <div className="flex gap-3">
                    {['Male', 'Female', 'Non-binary / Other'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => update('gender', g)}
                        className={`flex-1 py-2 rounded-full border font-ui text-sm transition-colors ${data.gender === g ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-ui text-sm">Tagline</Label>
                  <Input
                    placeholder="A short sentence about your approach (shown on your card)"
                    value={data.tagline}
                    onChange={(e) => update('tagline', e.target.value)}
                    maxLength={120}
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-ui text-sm">Bio</Label>
                  <Textarea
                    placeholder="Tell clients about yourself, your approach, and what you're passionate about…"
                    value={data.bio}
                    onChange={(e) => update('bio', e.target.value)}
                    rows={5}
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <ChipSelect
                  label="Specialisations"
                  options={SPECIALISATIONS}
                  selected={data.specialisations}
                  onChange={(v) => update('specialisations', v)}
                />
                <ChipSelect
                  label="Therapeutic Modalities"
                  options={MODALITIES}
                  selected={data.modalities}
                  onChange={(v) => update('modalities', v)}
                />
              </>
            )}

            {step === 2 && (
              <>
                <ChipSelect
                  label="Session Formats Offered"
                  options={SESSION_FORMATS}
                  selected={data.session_formats}
                  onChange={(v) => update('session_formats', v)}
                />
                <ChipSelect
                  label="Languages"
                  options={LANGUAGES}
                  selected={data.languages}
                  onChange={(v) => update('languages', v)}
                />
                <ChipSelect
                  label="Client Populations"
                  options={CLIENT_POPULATIONS}
                  selected={data.client_populations}
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
                  {data.cultural_competencies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {data.cultural_competencies.map((c) => (
                        <Badge key={c} variant="secondary" className="font-ui text-xs gap-1">
                          {c}
                          <button onClick={() => update('cultural_competencies', data.cultural_competencies.filter((x) => x !== c))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-ui text-sm">Price per Session</Label>
                    <Input
                      type="number"
                      value={data.price_per_session}
                      onChange={(e) => update('price_per_session', Number(e.target.value))}
                      onBlur={(e) => update('price_per_session', clampNum(e.target.value, 0, 1000000))}
                      min={0}
                      className="rounded-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-ui text-sm">Currency</Label>
                    <Select value={data.currency} onValueChange={(v) => update('currency', v)}>
                      <SelectTrigger className="rounded-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={data.sliding_scale}
                    onCheckedChange={(v) => update('sliding_scale', v)}
                  />
                  <Label className="font-ui text-sm">Offer sliding scale pricing</Label>
                </div>
                {data.sliding_scale && (
                  <div className="space-y-2">
                    <Label className="font-ui text-sm">Minimum sliding scale fee ({data.currency})</Label>
                    <Input
                      type="number"
                      value={data.sliding_scale_min}
                      onChange={(e) => update('sliding_scale_min', Number(e.target.value))}
                      onBlur={(e) => update('sliding_scale_min', clampNum(e.target.value, 0, data.price_per_session))}
                      min={0}
                      className="rounded-full"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="font-ui text-sm">Cancellation Policy</Label>
                  <Select value={data.cancellation_policy} onValueChange={(v) => update('cancellation_policy', v)}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24 hours">24-hour notice required</SelectItem>
                      <SelectItem value="48 hours">48-hour notice required</SelectItem>
                      <SelectItem value="Flexible">Flexible — no penalty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <div className="space-y-3">
                  <Label className="font-ui text-sm">CV & Cover Letter <span className="text-destructive">*</span></Label>
                  <p className="font-body text-xs text-muted-foreground">
                    Upload a single PDF, DOC, or DOCX file (max 5 MB) combining your CV and cover letter.
                    Previous versions are kept on file for reference.
                  </p>
                  <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-[var(--radius-card)] p-8 cursor-pointer transition-colors ${cvUrl ? 'border-success/40 bg-success/5' : 'border-border hover:border-primary/40'}`}>
                    <input
                      type="file"
                      accept={ACCEPTED_CV_TYPES}
                      className="sr-only"
                      onChange={handleCvSelect}
                    />
                    {cvUrl ? (
                      <>
                        <FileText className="h-8 w-8 text-success" />
                        <p className="font-ui text-sm text-success">Uploaded: {cvFile?.name}</p>
                        <p className="font-ui text-xs text-muted-foreground">Click to replace</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                        <p className="font-ui text-sm text-foreground">{cvFile ? cvFile.name : 'Click to choose file'}</p>
                        <p className="font-ui text-xs text-muted-foreground">PDF, DOC, DOCX — max 5 MB</p>
                      </>
                    )}
                  </label>

                  {cvFile && !cvUrl && (
                    <div className="space-y-2">
                      {uploading && (
                        <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                      <Button
                        type="button"
                        onClick={handleCvUpload}
                        disabled={uploading}
                        className="font-ui rounded-full w-full"
                      >
                        {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : <><UploadCloud className="mr-2 h-4 w-4" /> Upload CV</>}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="space-y-2">
                  <Label className="font-ui text-sm">Max Sessions per Day</Label>
                  <Input
                    type="number"
                    value={data.max_sessions_per_day}
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
                    value={data.buffer_minutes}
                    onChange={(e) => update('buffer_minutes', Number(e.target.value))}
                    onBlur={(e) => update('buffer_minutes', clampNum(e.target.value, 0, 120))}
                    min={0}
                    max={120}
                    step={5}
                    className="rounded-full"
                  />
                </div>
                <div className="bg-muted/50 rounded-[var(--radius-card)] p-6 border border-border">
                  <h3 className="font-display text-lg text-foreground mb-2">Ready to submit?</h3>
                  <p className="font-body text-sm text-muted-foreground mb-4">
                    Your profile will be reviewed by our team. Once verified, you'll appear in the therapist directory
                    and clients can start booking sessions with you.
                  </p>
                  <ul className="space-y-1.5 font-ui text-xs text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> Verification usually takes 1–2 business days</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> You can edit your profile anytime</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> Set up your calendar after onboarding</li>
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="font-ui rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} className="font-ui rounded-full">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving || !cvUrl} className="font-ui rounded-full">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : <>Submit Profile <Check className="ml-2 h-4 w-4" /></>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistOnboarding;
