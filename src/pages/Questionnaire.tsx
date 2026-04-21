import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Shield, Phone, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TOTAL_STEPS = 2;
const QUESTIONNAIRE_CONSENT_VERSION = '2026-04-12';
const QUESTIONNAIRE_DRAFT_KEY = 'nawe_questionnaire_draft';
const QUESTIONNAIRE_PENDING_FLAG = 'nawe_pending_questionnaire';

const CONCERNS = [
  'Anxiety', 'Depression', 'Stress', 'Grief & Loss', 'Relationship Issues',
  'Trauma / PTSD', 'Self-Esteem', 'Family Conflict', 'Life Transitions',
  'Anger Management', 'Substance Use', 'Eating & Body Image',
  'Identity & Belonging', 'Work / Career', 'Parenting', 'Sexual Health',
];

const SESSION_FORMATS = ['Video Call', 'Phone Call', 'In-Person', 'Chat / Messaging'];

interface FormData {
  age_range: string;
  gender_identity: string;
  contact_email: string;
  contact_phone: string;
  cultural_background: string;
  cultural_background_important: boolean;
  presenting_concerns: string[];
  previous_therapy: boolean | null;
  crisis_flag: boolean;
  session_format_preference: string[];
  frequency_preference: string;
  session_time_preference: string;
  therapist_gender_preference: string;
  experience_level_preference: string;
  language_preference: string;
  specialisation_importance: number;
  budget_range: string;
  insurance_coverage: string;
  sliding_scale_needed: boolean;
  additional_notes: string;
}

const initialData: FormData = {
  age_range: '',
  gender_identity: '',
  contact_email: '',
  contact_phone: '',
  cultural_background: '',
  cultural_background_important: false,
  presenting_concerns: [],
  previous_therapy: null,
  crisis_flag: false,
  session_format_preference: [],
  frequency_preference: '',
  session_time_preference: '',
  therapist_gender_preference: '',
  experience_level_preference: '',
  language_preference: 'English',
  specialisation_importance: 3,
  budget_range: '',
  insurance_coverage: '',
  sliding_scale_needed: false,
  additional_notes: '',
};

const Questionnaire = () => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [guestSubmitted, setGuestSubmitted] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem(QUESTIONNAIRE_DRAFT_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { data?: Partial<FormData>; consentAccepted?: boolean };
      if (parsed.data) {
        setData((prev) => ({ ...prev, ...parsed.data }));
      }
      if (typeof parsed.consentAccepted === 'boolean') {
        setConsentAccepted(parsed.consentAccepted);
      }
    } catch {
      localStorage.removeItem(QUESTIONNAIRE_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      QUESTIONNAIRE_DRAFT_KEY,
      JSON.stringify({
        data,
        consentAccepted,
      })
    );
  }, [consentAccepted, data]);

  const progress = (step / TOTAL_STEPS) * 100;

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const toggleArray = (key: 'presenting_concerns' | 'session_format_preference', value: string) => {
    setData((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const handleCallbackRequest = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const contactEmail = data.contact_email || session.session?.user.email || null;
      const contactPhone = data.contact_phone || null;

      if (!contactEmail && !contactPhone) {
        toast({
          title: 'Add a contact method',
          description: 'Please add an email address or phone number so our team can reach you back.',
          variant: 'destructive',
        });
        return;
      }

      await supabase.functions.invoke('guest-request', {
        body: {
          kind: 'callback',
          contact_email: contactEmail,
          contact_phone: contactPhone,
          intake_payload: data,
          crisis_flag: true,
        },
      });

      setShowCrisisModal(false);
      toast({
        title: 'Callback requested',
        description: 'Our team has received your urgent request and will respond as soon as possible.',
      });
    } catch (error) {
      toast({
        title: 'Could not request callback',
        description: error instanceof Error ? error.message : 'Please call the helpline now.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    if (!consentAccepted) {
      toast({
        title: 'Consent required',
        description: 'Please confirm that you consent to this data being processed for matching and service delivery.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        if (!data.contact_email && !data.contact_phone) {
          toast({
            title: 'Add a contact method',
            description: 'Please share an email address or phone number so we can follow up on your request as a guest.',
            variant: 'destructive',
          });
          return;
        }

        const { error: guestError } = await supabase.from('guest_intake_requests').insert({
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
          intake_payload: {
            ...data,
          },
          crisis_flag: data.crisis_flag,
          callback_requested: data.crisis_flag,
          consent_accepted_at: new Date().toISOString(),
          consent_version: QUESTIONNAIRE_CONSENT_VERSION,
        });

        if (guestError) throw guestError;

        await supabase.functions.invoke('guest-request', {
          body: {
            kind: 'intake',
            contact_email: data.contact_email || null,
            contact_phone: data.contact_phone || null,
            intake_payload: data,
            crisis_flag: data.crisis_flag,
          },
        });

        localStorage.removeItem(QUESTIONNAIRE_PENDING_FLAG);
        setGuestSubmitted(true);
        return;
      }

      // contact_email and contact_phone are guest-only fields; strip before upserting
      const { contact_email: _ce, contact_phone: _cp, ...intakeData } = data;
      const { error } = await supabase.from('intake_responses').upsert({
        user_id: session.session.user.id,
        ...intakeData,
        consent_accepted_at: new Date().toISOString(),
        consent_version: QUESTIONNAIRE_CONSENT_VERSION,
        completed: true,
      }, { onConflict: 'user_id' });

      if (error) throw error;

      localStorage.removeItem(QUESTIONNAIRE_PENDING_FLAG);
      localStorage.removeItem(QUESTIONNAIRE_DRAFT_KEY);
      toast({ title: 'Questionnaire saved!', description: "We're finding your best matches." });
      navigate('/matches');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (guestSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="max-w-xl w-full rounded-card shadow-soft border border-border">
          <CardContent className="p-8 space-y-4 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <Heart className="h-7 w-7 text-success" />
            </div>
            <h2 className="font-display text-3xl text-foreground">We received your request</h2>
            <p className="font-body text-muted-foreground">
              You can continue as a guest. If you shared an email address, we will send instructions so you can complete
              registration later. Our team will also review your request and follow up. You can browse therapists now,
              but you will need to sign in before booking.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button className="font-ui rounded-full" onClick={() => navigate('/matches')}>
                Browse Therapists
              </Button>
              <Button variant="outline" className="font-ui rounded-full" onClick={() => navigate('/signup')}>
                Create Account to Book
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-ui text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2 text-muted-foreground font-ui text-xs">
            <Shield className="h-3.5 w-3.5" /> Private & Secure
          </div>
        </div>
        <div className="container mx-auto px-6 pb-4">
          <Progress value={progress} className="h-2" />
          <p className="font-ui text-xs text-muted-foreground mt-2">Step {step} of {TOTAL_STEPS}</p>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-6 py-10 max-w-2xl">
        {/* Crisis banner */}
        {data.crisis_flag && (
          <div className="mb-6 p-4 rounded-card bg-destructive/10 border border-destructive/30 flex items-start gap-3">
            <Phone className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-ui text-sm font-medium text-destructive">If you're in immediate danger, please reach out now</p>
              <p className="font-body text-xs text-muted-foreground mt-1">
                Kenya: 0800 723 253 · Tanzania: 116 · Uganda: 0800 21 21 21
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <StepQuickIntake
            data={data}
            update={update}
            toggleArray={toggleArray}
            onCrisisChange={(checked) => {
              update('crisis_flag', checked);
              if (checked) setShowCrisisModal(true);
            }}
          />
        )}
        {step === 2 && (
          <StepQuickPreferences
            data={data}
            update={update}
            consentAccepted={consentAccepted}
            setConsentAccepted={setConsentAccepted}
          />
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-10">
          <Button variant="ghost" onClick={back} disabled={step === 1} className="font-ui">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {step < TOTAL_STEPS ? (
            <Button onClick={next} className="font-ui rounded-full px-8">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !consentAccepted} className="font-ui rounded-full px-8 bg-accent hover:bg-accent/90 text-accent-foreground">
              {submitting ? 'Saving…' : 'Find My Matches'}
              <Heart className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showCrisisModal} onOpenChange={setShowCrisisModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Immediate support</DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              If you may harm yourself or someone else, get urgent help now. This is not a substitute for emergency care.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-card border border-border bg-muted/20 p-4 space-y-2">
              <p className="font-ui text-sm font-medium text-foreground">Call right now</p>
              <p className="font-body text-sm text-muted-foreground">
                Go to the nearest emergency facility or call local emergency services immediately.
              </p>
              <a
                href="tel:+254202717077"
                className="inline-flex font-ui text-sm text-primary hover:underline"
              >
                Ministry of Health: +254 20 2717077
              </a>
            </div>

            <div className="rounded-card border border-border bg-card p-4 space-y-3">
              <div>
                <p className="font-ui text-sm font-medium text-foreground">Add a contact method</p>
                <p className="font-body text-sm text-muted-foreground mt-1">
                  Share an email or phone number and we will use Resend on the backend to alert our team and follow up.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  value={data.contact_email}
                  onChange={(e) => update('contact_email', e.target.value)}
                  placeholder="Email address"
                  type="email"
                  className="rounded-card"
                  maxLength={120}
                />
                <Input
                  value={data.contact_phone}
                  onChange={(e) => update('contact_phone', e.target.value)}
                  placeholder="Phone number"
                  type="tel"
                  className="rounded-card"
                  maxLength={40}
                />
              </div>
              <p className="font-ui text-xs text-muted-foreground">
                Leave either field blank if you only want a callback by the other method.
              </p>
            </div>

            <p className="font-body text-sm text-muted-foreground">
              If you want, we can also notify our team to arrange a callback from the next available therapist or support
              staff member.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="font-ui rounded-full flex-1" onClick={handleCallbackRequest}>
                Request Callback
              </Button>
              <Button variant="outline" className="font-ui rounded-full flex-1" onClick={() => setShowCrisisModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Step Components ─── */

const StepHeading = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mb-8">
    <h2 className="font-display text-2xl md:text-3xl text-foreground mb-2">{title}</h2>
    <p className="font-body text-muted-foreground">{subtitle}</p>
  </div>
);

const OptionCard = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left p-4 rounded-card border transition-all font-ui text-sm ${
      selected
        ? 'border-primary bg-primary/5 shadow-sm'
        : 'border-border bg-card hover:border-primary/40'
    }`}
  >
    {children}
  </button>
);

// Step 1: Quick Intake
const StepQuickIntake = ({
  data,
  update,
  toggleArray,
  onCrisisChange,
}: {
  data: FormData;
  update: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
  toggleArray: (key: 'presenting_concerns' | 'session_format_preference', v: string) => void;
  onCrisisChange: (checked: boolean) => void;
}) => (
  <div>
    <StepHeading title="Tell us what you need" subtitle="Tell us a little about what you’re looking for." />

    <div className="space-y-6">
      <div>
        <Label className="font-ui text-sm mb-3 block">How can we reach you? (optional if signed in)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            value={data.contact_email}
            onChange={(e) => update('contact_email', e.target.value)}
            placeholder="Email address"
            type="email"
            className="rounded-card"
            maxLength={120}
          />
          <Input
            value={data.contact_phone}
            onChange={(e) => update('contact_phone', e.target.value)}
            placeholder="Phone number"
            type="tel"
            className="rounded-card"
            maxLength={40}
          />
        </div>
        <p className="font-ui text-xs text-muted-foreground mt-2">
          If you continue as a guest, we’ll use your contact details only to follow up on your request and, if you share an
          email address, send registration instructions later.
        </p>
      </div>

      <div>
        <Label className="font-ui text-sm mb-3 block">What would you like support with?</Label>
        <div className="grid grid-cols-2 gap-3">
          {CONCERNS.map((c) => (
            <OptionCard key={c} selected={data.presenting_concerns.includes(c)} onClick={() => toggleArray('presenting_concerns', c)}>
              {c}
            </OptionCard>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-3 p-4 rounded-card border border-border bg-card font-ui text-sm cursor-pointer">
          <Checkbox checked={data.crisis_flag} onCheckedChange={(v) => onCrisisChange(v === true)} />
          <span>I'm currently experiencing a crisis or thoughts of self-harm</span>
        </label>
      </div>
    </div>
  </div>
);

// Step 2: Minimal Preferences
const StepQuickPreferences = ({
  data,
  update,
  consentAccepted,
  setConsentAccepted,
}: {
  data: FormData;
  update: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
  consentAccepted: boolean;
  setConsentAccepted: (value: boolean) => void;
}) => (
  <div>
    <StepHeading title="A few preferences" subtitle="Just enough to help us find a therapist who fits." />

    <div className="space-y-6">
      <div>
        <Label className="font-ui text-sm mb-3 block">Preferred session format</Label>
        <div className="grid grid-cols-2 gap-3">
          {SESSION_FORMATS.map((f) => (
            <OptionCard
              key={f}
              selected={data.session_format_preference.includes(f)}
              onClick={() => update('session_format_preference', data.session_format_preference.includes(f) ? [] : [f])}
            >
              {f}
            </OptionCard>
          ))}
        </div>
      </div>

      <div>
        <Label className="font-ui text-sm mb-3 block">Budget per session</Label>
        <div className="grid grid-cols-2 gap-3">
          {['Under 2,000', '2,000–5,000', '5,000–10,000', '10,000+', 'Not sure'].map((b) => (
            <OptionCard key={b} selected={data.budget_range === b} onClick={() => update('budget_range', b)}>
              {b}
            </OptionCard>
          ))}
        </div>
      </div>

      <div>
        <Label className="font-ui text-sm mb-3 block">Therapist gender preference</Label>
        <div className="grid grid-cols-2 gap-3">
          {['Female', 'Male', 'No preference'].map((g) => (
            <OptionCard key={g} selected={data.therapist_gender_preference === g} onClick={() => update('therapist_gender_preference', g)}>
              {g}
            </OptionCard>
          ))}
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-5 flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-ui text-sm font-medium text-foreground">Your privacy matters</p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              We use your answers to match you with therapists and manage your request. Do not include emergency details here.
              Read our{' '}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{' '}
              for the full details.
            </p>
          </div>
        </CardContent>
      </Card>

      <label className="flex items-start gap-3 p-4 rounded-card border border-border bg-card font-ui text-sm cursor-pointer">
        <Checkbox
          checked={consentAccepted}
          onCheckedChange={(v) => setConsentAccepted(v === true)}
          className="mt-0.5"
        />
        <span className="leading-snug text-muted-foreground">
          I consent to Nawe processing the personal and health-related information I provide here to match me with therapists
          and manage therapy-related services, as described in the{' '}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
    </div>
  </div>
);

export default Questionnaire;
