import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight, Check,
  Users, GraduationCap, Shield, Building2,
  Loader2, CheckCircle2,
} from 'lucide-react';

// /grow — Organisational Health. Explains the offer first, then pricing in its
// own section (decision: keep explainer + pricing on one page for now). One
// primary call to action, "Discuss Organisational Health", opens the enquiry
// form; package buttons open the same form tagged with that package.
// Copy follows the Website Repositioning strategy (V2): no unverified claims,
// no promised outcomes. /organizations redirects here.

// ─── Data ────────────────────────────────────────────────────────────────────

const plans = [
  {
    id: 'essential',
    name: 'TIER 1',
    price: 'KES 950',
    period: 'per employee / month',
    description: 'For organisations beginning to build a structured approach to workforce wellbeing and organisational health.',
    bestFor: 'Organisations that want to establish a baseline and understand the health of their workforce.',
    ctaLabel: 'Get Started',
    lead: '',
    highlight: false,
    popular: false,
    headerBg: 'bg-brand-navy',
    priceBg: 'bg-brand-sky',
    priceColor: 'text-brand-navy',
    priceMeta: 'text-brand-navy/60',
    featureBg: 'bg-background',
    featureText: 'text-foreground',
    checkBg: 'border border-brand-navy/20 bg-background',
    checkColor: 'text-brand-navy/50',
    ctaBg: 'bg-brand-navy hover:bg-brand-navy/90 text-white',
    features: [
      'Organisational Health Assessment',
      'Organisational Health Report',
      'Workforce Wellbeing Index',
      'Burnout Risk Profile',
      'Mental health and wellbeing resources',
      '2 wellbeing and mental-health sessions per year',
      'Quarterly organisational health report',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'TIER 2',
    price: 'KES 1,175',
    period: 'per employee / month',
    description: 'For organisations that want deeper organisational insight and structured interventions.',
    bestFor: 'Organisations that want to move from measuring workforce health to actively improving it.',
    ctaLabel: 'Choose Tier 2',
    lead: 'Everything in Tier 1, plus:',
    highlight: true,
    popular: true,
    headerBg: 'bg-brand-navy',
    priceBg: 'bg-brand-sky',
    priceColor: 'text-brand-navy',
    priceMeta: 'text-brand-navy/70',
    featureBg: 'bg-background',
    featureText: 'text-foreground',
    checkBg: 'bg-brand-sky',
    checkColor: 'text-brand-navy',
    ctaBg: 'bg-brand-navy hover:bg-brand-navy/90 text-white',
    features: [
      'Enhanced Organisational Health Assessment',
      'Leadership Health assessment',
      'Psychological Safety assessment',
      'Team Effectiveness assessment',
      'Department-level heat maps',
      'Leadership Health Dashboard',
      'Quarterly organisational health review',
      'Targeted leadership intervention',
      'Team effectiveness intervention',
      'Psychological safety intervention',
      '4 organisational wellbeing sessions per year',
      'Priority access to NAWE support',
    ],
  },
  {
    id: 'enterprise',
    name: 'TIER 3',
    price: 'Custom',
    period: 'tailored to your organisation',
    description: 'For large organisations and institutions requiring a comprehensive organisational health programme.',
    bestFor: 'Large organisations, institutions and organisations with complex workforce needs.',
    ctaLabel: 'Talk to NAWE',
    lead: "Everything in Tier 2, with a programme designed around your organisation's needs. May include:",
    highlight: false,
    popular: false,
    headerBg: 'bg-brand-navy',
    priceBg: 'bg-brand-sand',
    priceColor: 'text-brand-navy',
    priceMeta: 'text-brand-navy/60',
    featureBg: 'bg-background',
    featureText: 'text-foreground',
    checkBg: 'border border-brand-navy/20 bg-background',
    checkColor: 'text-brand-navy/50',
    ctaBg: 'bg-brand-navy hover:bg-brand-navy/90 text-white',
    features: [
      'Full organisational health assessment',
      'Leadership health assessment',
      'Psychological safety assessment',
      'Team effectiveness assessment',
      'Burnout and workforce risk analysis',
      'Executive and leadership support',
      'Bespoke organisational interventions',
      'Custom reporting and dashboards',
      'Ongoing measurement and impact tracking',
      'Integration with existing HR and people systems',
      'Dedicated account management',
      'Organisation-specific service-level arrangements',
    ],
  },
];

const problems = [
  { title: 'Burnout risk', body: 'Exhaustion and strain that stay hidden behind people who still look productive.' },
  { title: 'Workload and role clarity', body: 'Understaffing, competing priorities and roles that have drifted from what was agreed.' },
  { title: 'Leadership and management', body: 'How communication, fairness and day-to-day management shape people’s experience of work.' },
  { title: 'Psychological safety', body: 'Whether people can raise concerns, admit mistakes and ask for help without fear.' },
  { title: 'Retention and engagement', body: 'Turnover and disengagement as signals of underlying conditions, not isolated events.' },
  { title: 'Silence around support', body: 'Low uptake of support because of stigma, confidentiality doubts or not knowing what exists.' },
];

const steps = [
  { title: 'Assess', body: 'Agree the scope, participants and safeguards, then gather structured information about how people experience work.' },
  { title: 'Understand', body: 'Interpret the findings responsibly and identify strengths, patterns, risks and priorities.' },
  { title: 'Intervene', body: 'Agree targeted interventions and owners, such as leadership development, team facilitation, wellbeing initiatives and access to psychological support.' },
  { title: 'Improve', body: 'Review progress against agreed measures and adjust what is not working.' },
];

const value = [
  'A clearer picture of how your people experience work',
  'Priorities grounded in evidence rather than assumptions',
  'Interventions that address working conditions, not only individuals',
  'Agreed measures for tracking progress over time',
];

const partnerTypes = [
  { icon: Building2,    title: 'Corporations', body: 'Understand workforce health and organisational risks.' },
  { icon: Users,        title: 'NGOs & Civil Society', body: 'Support staff wellbeing, leadership and the demands of field-based work.' },
  { icon: Shield,       title: 'Government & Public Institutions', body: 'Strengthen workforce wellbeing and organisational systems.' },
  { icon: GraduationCap, title: 'Institutions & Other Organisations', body: 'Assess organisational health and develop targeted interventions.' },
];

const includedAll = [
  'Onboarding support',
  'Therapist matching',
  'Session scheduling',
  'Monthly aggregate reporting',
  'Kenya DPA compliance documentation',
];

// ─── Enquiry Dialog ──────────────────────────────────────────────────────────

type Plan = typeof plans[number];
type Status = 'idle' | 'loading' | 'done' | 'error';

interface Fields {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  employees: string;
  message: string;
}

const EMPTY: Fields = { companyName: '', contactName: '', email: '', phone: '', employees: '', message: '' };

const PRIMARY_CTA = 'Discuss Organisational Health';

// plan = null → general Organisational Health enquiry (the primary CTA).
function EnquiryDialog({ plan, open, onClose }: { plan: Plan | null; open: boolean; onClose: () => void }) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    fields.companyName.trim() &&
    fields.contactName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email);

  const handleSubmit = async () => {
    setStatus('loading');
    setErrorMsg('');
    const { error } = await supabase.functions.invoke('corporate-enquiry', {
      body: {
        company_name: fields.companyName.trim(),
        contact_name: fields.contactName.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim() || null,
        employees: parseInt(fields.employees) || null,
        plan: plan?.name ?? null,
        message: fields.message.trim() || null,
      },
    });
    if (error) {
      setErrorMsg('Something went wrong. Please try again or email us directly.');
      setStatus('error');
    } else {
      setStatus('done');
    }
  };

  const reset = () => { setFields(EMPTY); setStatus('idle'); setErrorMsg(''); };

  const inputCls = 'w-full rounded-lg px-4 py-2.5 font-ui text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-brand-navy/60 transition-colors';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-brand-navy">
            {status === 'done' ? 'Enquiry received' : plan ? `${plan.name} — enquiry` : PRIMARY_CTA}
          </DialogTitle>
        </DialogHeader>

        {status === 'done' ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-brand-navy mx-auto" />
            <p className="font-body text-base text-brand-navy">
              Thank you. A member of our team will be in touch at <strong>{fields.email}</strong>.
            </p>
            <Button onClick={() => { reset(); onClose(); }} className="font-ui rounded-full bg-brand-navy hover:bg-brand-navy/90 text-white">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <p className="font-body text-sm text-muted-foreground">
              Tell us about your organisation and what you would like to understand. Share only what is needed for an initial conversation — please do not include employee names or health details.
            </p>
            <input placeholder="Organisation name *" value={fields.companyName} onChange={set('companyName')} className={inputCls} />
            <input placeholder="Your name *" value={fields.contactName} onChange={set('contactName')} className={inputCls} />
            <input type="email" placeholder="Work email *" value={fields.email} onChange={set('email')} className={inputCls} />
            <input placeholder="Phone number" value={fields.phone} onChange={set('phone')} className={inputCls} />
            <input type="number" placeholder="Number of employees" value={fields.employees} onChange={set('employees')} min={1} className={inputCls} />
            <textarea
              placeholder="What would you like to understand or improve? (optional)"
              value={fields.message}
              onChange={set('message')}
              rows={3}
              className={`${inputCls} resize-none`}
            />
            {errorMsg && <p className="font-ui text-sm text-destructive">{errorMsg}</p>}
            <Button
              disabled={!valid || status === 'loading'}
              onClick={handleSubmit}
              className="w-full font-ui rounded-full bg-brand-navy hover:bg-brand-navy/90 text-white disabled:opacity-60"
            >
              {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : <>Send Enquiry <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
            <p className="font-ui text-xs text-muted-foreground">This form is not for urgent or emergency support.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const Grow = () => {
  const [enquiry, setEnquiry] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const openEnquiry = (plan: Plan | null = null) => setEnquiry({ open: true, plan });

  const PrimaryCta = () => (
    <Button
      size="lg"
      onClick={() => openEnquiry()}
      className="font-ui text-base px-8 py-6 rounded-full bg-brand-navy hover:bg-brand-navy/90 text-white shadow-soft"
    >
      {PRIMARY_CTA} <ArrowRight className="ml-2 h-5 w-5" />
    </Button>
  );

  return (
  <>
  <div>

    {/* HERO */}
    <section className="relative py-28 bg-brand-sky overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-brand-sand translate-x-1/3 -translate-y-1/3 pointer-events-none opacity-60" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl">
          <div className="inline-block border border-brand-navy/20 rounded-full px-4 py-1.5 font-ui text-sm text-brand-navy/60 uppercase tracking-widest mb-8">
            Grow · Organisational Health
          </div>
          <h1 className="font-display text-5xl md:text-7xl text-brand-navy leading-none mb-8">
            Build a healthier organisation from the inside out.
          </h1>
          <p className="font-body text-xl text-brand-navy/80 leading-relaxed mb-10 max-w-2xl">
            An organisation’s health is shaped by how people experience work every day. Nawe helps organisations understand those conditions, then agree practical steps to improve them.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <PrimaryCta />
            <a href="#pricing" className="font-ui text-base text-brand-navy underline-offset-4 hover:underline">
              See packages and pricing
            </a>
          </div>
        </div>
      </div>
    </section>

    {/* WHAT IS ORGANISATIONAL HEALTH */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-6">What is organisational health?</h2>
          <p className="font-body text-lg text-foreground leading-relaxed mb-4">
            Organisational health is the ability of an organisation to create conditions in which people can contribute, work together, adapt and perform sustainably.
          </p>
          <p className="font-body text-lg text-muted-foreground leading-relaxed">
            It is not a single survey score or a one-off wellness event. It means understanding the systems, relationships and everyday practices that shape people’s experience: the clarity of leadership, how teams communicate, the demands placed on people, and whether they can raise concerns and access support.
          </p>
        </div>
        <img
          src="/site-revamp/team_session.webp"
          alt="A team in a meeting around a conference table"
          className="w-full rounded-card object-cover aspect-[4/3]"
          loading="lazy"
        />
      </div>
    </section>

    {/* PROBLEMS WE ADDRESS */}
    <section className="py-24 bg-brand-sand">
      <div className="container mx-auto px-6">
        <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-4 max-w-3xl">What we help organisations address</h2>
        <p className="font-body text-lg text-brand-navy/70 max-w-3xl mb-12">
          Before asking what is wrong with a person, we look at what is happening in the work.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((p) => (
            <div key={p.title} className="border-t border-brand-navy/25 pt-6">
              <h3 className="font-display text-2xl text-brand-navy mb-2">{p.title}</h3>
              <p className="font-body text-base text-brand-navy/75 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ENGAGEMENT MODEL */}
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-4">How an engagement works</h2>
        <p className="font-body text-lg text-brand-navy/70 leading-relaxed max-w-3xl mb-14">
          We start with your context, then agree the questions, participants, safeguards, deliverables, timeline and budget. Assessment leads directly to action.
        </p>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <li key={s.title} className="bg-brand-sky rounded-card p-8 flex flex-col gap-3">
              <span className="font-ui text-sm font-medium text-brand-navy/60">Step {i + 1}</span>
              <h3 className="font-display text-2xl text-brand-navy">{s.title}</h3>
              <p className="font-body text-base text-brand-navy/70 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    {/* VALUE TO EMPLOYERS */}
    <section className="py-24 bg-brand-sky">
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div>
          <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-6">What employers gain</h2>
          <p className="font-body text-lg text-brand-navy/70 leading-relaxed">
            Outcomes depend on your context, so we agree measures with you rather than promise results.
          </p>
        </div>
        <ul className="space-y-4">
          {value.map((v) => (
            <li key={v} className="flex items-start gap-3 border-b border-brand-navy/20 pb-4">
              <Check className="h-5 w-5 text-brand-navy shrink-0 mt-1" />
              <span className="font-body text-lg text-brand-navy">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* WHO WE WORK WITH */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <h2 className="font-display text-3xl md:text-4xl text-foreground mb-10">Who we work with</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {partnerTypes.map((p) => (
            <div key={p.title} className="bg-background border border-border rounded-card p-7 flex gap-5 shadow-card">
              <div className="w-12 h-12 rounded-full bg-brand-sky flex items-center justify-center shrink-0">
                <p.icon className="h-5 w-5 text-brand-navy" />
              </div>
              <div>
                <h3 className="font-display text-xl text-foreground mb-2">{p.title}</h3>
                <p className="font-body text-base text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="font-body text-base text-muted-foreground leading-relaxed max-w-3xl mt-10">
          <span className="font-ui font-semibold text-foreground">Privacy and trust.</span>{' '}
          Before any assessment, we agree with you what information is collected, why, who can access it and how results are reported, so employees can take part with confidence.
        </p>
      </div>
    </section>

    {/* PACKAGES AND PRICING — kept separate from the explainer above */}
    <section id="pricing" className="py-24 bg-background scroll-mt-20">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-6">Pricing</div>
        <h2 className="font-display text-5xl md:text-6xl text-brand-navy mb-4">Packages and pricing</h2>
        <p className="font-body text-lg text-muted-foreground max-w-3xl mb-14">Choose the level of support that fits your organisation, or talk to us about a scope that suits your context.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div key={plan.id} className="relative pt-10">
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <span className="font-ui text-xs font-bold px-4 py-1.5 rounded-full bg-brand-navy text-brand-sky uppercase tracking-widest shadow-soft">Most Popular</span>
                </div>
              )}
              <div className={`rounded-card overflow-hidden border shadow-card ${plan.highlight ? 'border-brand-navy shadow-soft' : 'border-border'}`}>
              <div className={`${plan.headerBg} px-8 text-center ${plan.popular ? 'pt-8 pb-5' : 'py-5'}`}>
                <h3 className="font-ui text-sm font-bold text-white uppercase tracking-widest">{plan.name}</h3>
              </div>
              <div className={`${plan.priceBg} px-8 py-8 text-center border-b border-black/10`}>
                <p className={`font-display text-5xl font-bold ${plan.priceColor} mb-1`}>{plan.price}</p>
                <p className={`font-ui text-sm ${plan.priceMeta} italic`}>{plan.period}</p>
                <p className={`font-body text-sm ${plan.priceMeta} mt-4 leading-relaxed`}>{plan.description}</p>
              </div>
              <div className={`px-8 py-6 space-y-3 ${plan.featureBg}`}>
                {plan.lead && <p className={`font-ui text-sm font-semibold ${plan.featureText}`}>{plan.lead}</p>}
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${plan.checkBg}`}>
                      <Check className={`h-3 w-3 ${plan.checkColor}`} />
                    </div>
                    <p className={`font-body text-sm leading-relaxed ${plan.featureText}`}>{f}</p>
                  </div>
                ))}
              </div>
              <div className={`px-8 pb-8 pt-4 ${plan.featureBg}`}>
                <p className={`font-ui text-xs italic mb-4 ${plan.priceMeta}`}>Best for: {plan.bestFor}</p>
                <Button onClick={() => openEnquiry(plan)} className={`w-full font-ui rounded-full ${plan.ctaBg}`}>
                  {plan.ctaLabel}
                </Button>
              </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-[#f7f0e8] border border-[#eaccac]/40 rounded-card px-8 py-4">
          <p className="font-ui text-sm text-brand-navy/70 text-center">
            <span className="font-semibold text-brand-navy">All plans include: </span>
            {includedAll.join(' • ')}
          </p>
        </div>
      </div>
    </section>

    {/* CLOSING CTA */}
    <section className="py-24 bg-brand-sky">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-4">Start a conversation</h2>
          <p className="font-body text-lg text-brand-navy/70 mb-8 leading-relaxed">
            Tell us about your organisation, the people you support and the challenge you want to understand. We will discuss whether Nawe is a fit and what a responsible engagement could look like.
          </p>
          <PrimaryCta />
        </div>
      </div>
    </section>

  </div>

  <EnquiryDialog
    plan={enquiry.plan}
    open={enquiry.open}
    onClose={() => setEnquiry({ open: false, plan: null })}
  />
  </>
  );
};

export default Grow;
