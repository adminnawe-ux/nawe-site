import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight, Check, Mail, DollarSign,
  Users, GraduationCap, Shield, Building2,
  Loader2, CheckCircle2,
} from 'lucide-react';

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

const steps = [
  { title: 'ASSESS', body: 'Get structured information from your workforce.' },
  { title: 'UNDERSTAND', body: 'Identify strengths, patterns, risks and areas requiring attention.' },
  { title: 'INTERVENE', body: 'Develop targeted interventions based on the findings.' },
  { title: 'IMPROVE', body: 'Track progress and support continued organisational health.' },
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

// ─── Corporate Enquiry Dialog ────────────────────────────────────────────────

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

function CorporateEnquiryDialog({ plan, open, onClose }: { plan: Plan; open: boolean; onClose: () => void }) {
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
        plan: plan.name,
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
            {status === 'done' ? 'Enquiry received' : `${plan.name} Plan — Get Started`}
          </DialogTitle>
        </DialogHeader>

        {status === 'done' ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-brand-navy mx-auto" />
            <p className="font-body text-base text-brand-navy">
              Thanks, {fields.companyName}! Our team will be in touch with you at <strong>{fields.email}</strong> within 24 hours.
            </p>
            <Button onClick={() => { reset(); onClose(); }} className="font-ui rounded-full bg-brand-navy hover:bg-brand-navy/90 text-white">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <p className="font-body text-sm text-muted-foreground">Fill in your details and our team will reach out within 24 hours.</p>
            <input placeholder="Company name *" value={fields.companyName} onChange={set('companyName')} className={inputCls} />
            <input placeholder="Contact person name *" value={fields.contactName} onChange={set('contactName')} className={inputCls} />
            <input type="email" placeholder="Work email *" value={fields.email} onChange={set('email')} className={inputCls} />
            <input placeholder="Phone number" value={fields.phone} onChange={set('phone')} className={inputCls} />
            <input type="number" placeholder="Number of employees" value={fields.employees} onChange={set('employees')} min={1} className={inputCls} />
            <textarea
              placeholder="Anything else you'd like us to know? (optional)"
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const Grow = () => {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  return (
  <>
  <div>

    {/* HERO */}
    <section className="relative py-28 bg-brand-sky overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-brand-sand translate-x-1/3 -translate-y-1/3 pointer-events-none opacity-60" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl">
          <div className="inline-block border border-brand-navy/20 rounded-full px-4 py-1.5 font-ui text-sm text-brand-navy/60 uppercase tracking-widest mb-8">
            Partnerships & Collaborations
          </div>
          <h1 className="font-display text-5xl md:text-7xl text-brand-navy leading-none mb-6">Grow</h1>
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-3xl md:text-4xl text-brand-navy mb-3">Organisational Health</h2>
            <p className="font-body text-xl text-brand-navy/80 leading-relaxed mb-4">
              Understand the health of your organisation. Act on what you find.
            </p>
            <p className="font-body text-lg text-brand-navy/70 leading-relaxed mb-4">
              We assess workforce wellbeing, leadership, psychological safety, team effectiveness and organisational risks, then work with your organisation to develop targeted interventions.
            </p>
            <p className="font-ui text-sm text-brand-navy uppercase tracking-widest">
              Assess. Understand. Intervene. Improve.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="mailto:connect@nawe.co.ke?subject=Partnership%20Enquiry">
              <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-brand-navy hover:bg-brand-navy/90 text-white shadow-soft">
                <Mail className="mr-2 h-5 w-5" /> Get a free assessment
              </Button>
            </a>
            <a href="#pricing">
              <Button size="lg" variant="outline" className="font-ui text-base px-8 py-6 rounded-full border-brand-navy/30 text-brand-navy hover:bg-brand-navy/8">
                View Pricing <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>

    {/* THREE PILLARS */}
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">Our Approach</div>
        <p className="font-body text-lg text-brand-navy/70 leading-relaxed max-w-3xl mb-14">
          Traditional employee surveys tell you what people think at a particular point in time. Organisational health looks more broadly at the conditions affecting how people experience and perform within the organisation. We connect assessment with action. Assess → Understand → Intervene → Improve
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.title} className="bg-brand-sky rounded-card p-8 flex flex-col gap-4">
              <h3 className="font-display text-2xl text-brand-navy">{s.title}</h3>
              <p className="font-body text-base text-brand-navy/70 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* PARTNER TYPES */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">Who we work with</div>
        <p className="font-display text-3xl md:text-4xl text-foreground mb-10">Built for organisations that want to understand their people.</p>
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
      </div>
    </section>

    {/* CORPORATE PRICING */}
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-6">Packages</div>
        <h2 className="font-display text-5xl md:text-6xl text-brand-navy mb-4">Organisational Health Packages</h2>
        <p className="font-body text-lg text-muted-foreground max-w-3xl mb-14">NAWE helps organisations understand the health of their people and workplace, identify areas of risk, and take informed action. Choose the level of support that fits your organisation.</p>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div key={plan.id} className="relative pt-10">
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <span className="font-ui text-xs font-bold px-4 py-1.5 rounded-full bg-brand-navy text-brand-sky uppercase tracking-widest shadow-soft">Most Popular</span>
                </div>
              )}
              <div className={`rounded-card overflow-hidden border shadow-card ${plan.highlight ? 'border-brand-navy shadow-soft' : 'border-border'}`}>
              {/* Header */}
              <div className={`${plan.headerBg} px-8 text-center ${plan.popular ? 'pt-8 pb-5' : 'py-5'}`}>
                <h3 className="font-ui text-sm font-bold text-white uppercase tracking-widest">{plan.name}</h3>
              </div>
              {/* Price block */}
              <div className={`${plan.priceBg} px-8 py-8 text-center border-b border-black/10`}>
                <p className={`font-display text-5xl font-bold ${plan.priceColor} mb-1`}>{plan.price}</p>
                <p className={`font-ui text-sm ${plan.priceMeta} italic`}>{plan.period}</p>
                <p className={`font-body text-sm ${plan.priceMeta} mt-4 leading-relaxed`}>{plan.description}</p>
              </div>
              {/* Features */}
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
              {/* CTA */}
              <div className={`px-8 pb-8 pt-4 ${plan.featureBg}`}>
                <p className={`font-ui text-xs italic mb-4 ${plan.priceMeta}`}>Best for: {plan.bestFor}</p>
                <Button onClick={() => setSelectedPlan(plan)} className={`w-full font-ui rounded-full ${plan.ctaBg}`}>
                  {plan.ctaLabel}
                </Button>
              </div>
              </div>
            </div>
          ))}
        </div>

        {/* All plans include */}
        <div className="mt-8 bg-[#f7f0e8] border border-[#eaccac]/40 rounded-card px-8 py-4">
          <p className="font-ui text-sm text-brand-navy/70 text-center">
            <span className="font-semibold text-brand-navy">All plans include: </span>
            {includedAll.join(' • ')}
          </p>
        </div>
      </div>
    </section>

    {/* CTA BANNER */}
    <section className="py-24 bg-brand-sky">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <DollarSign className="h-10 w-10 text-brand-navy/40 mx-auto mb-6" />
          <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-4">Start with an assessment</h2>
          <p className="font-body text-lg text-brand-navy/70 mb-8 leading-relaxed">
            Understand what your people need first, then we'll design a programme that fits your organisation's size, budget, and goals.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="mailto:connect@nawe.co.ke?subject=Organizational%20Health%20Assessment%20Enquiry">
              <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-brand-navy hover:bg-brand-navy/90 text-white shadow-soft">
                <Mail className="mr-2 h-5 w-5" /> Get a free assessment
              </Button>
            </a>
            <Link to="/">
              <Button size="lg" variant="outline" className="font-ui text-base px-8 py-6 rounded-full border-brand-navy/30 text-brand-navy hover:bg-brand-navy/8">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>

  </div>

  {selectedPlan && (
    <CorporateEnquiryDialog
      plan={selectedPlan}
      open={!!selectedPlan}
      onClose={() => setSelectedPlan(null)}
    />
  )}
  </>
  );
};

export default Grow;
