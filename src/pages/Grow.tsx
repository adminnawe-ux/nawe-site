import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight, Check, Mail, DollarSign,
  Users, GraduationCap, BarChart3, Shield, Building2,
  Loader2, CheckCircle2,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

const plans = [
  {
    id: 'starter',
    name: 'STARTER',
    usd: '$5.00',
    kes: 'KES 650',
    period: 'per employee / month',
    bestFor: '50–200 staff',
    highlight: false,
    popular: false,
    headerBg: 'bg-[#000b3d]',
    priceBg: 'bg-[#c8e6f7]',
    priceColor: 'text-[#000b3d]',
    priceMeta: 'text-[#000b3d]/60',
    featureBg: 'bg-background',
    featureText: 'text-foreground',
    checkBg: 'border border-[#000b3d]/20 bg-background',
    checkColor: 'text-[#000b3d]/50',
    ctaBg: 'bg-[#000b3d] hover:bg-[#000b3d]/90 text-white',
    features: [
      'HEAL platform access',
      'Individual & couples therapy',
      'Mental health workshops (2/yr)',
      'Monthly wellbeing reporting',
      'Email & chat support',
      'Setup: Free',
    ],
  },
  {
    id: 'growth',
    name: 'GROWTH',
    usd: '$7.50',
    kes: 'KES 975',
    period: 'per employee / month',
    bestFor: '200–1,000 staff',
    highlight: true,
    popular: true,
    headerBg: 'bg-[#000b3d]',
    priceBg: 'bg-[#000b3d]',
    priceColor: 'text-[#c8e6f7]',
    priceMeta: 'text-[#c8e6f7]/60',
    featureBg: 'bg-[#000b3d]',
    featureText: 'text-white/80',
    checkBg: 'bg-[#c8e6f7]',
    checkColor: 'text-[#000b3d]',
    ctaBg: 'bg-[#c8e6f7] hover:bg-[#c8e6f7]/90 text-[#000b3d]',
    features: [
      'Everything in Starter',
      'Caregiver support tier',
      'Quarterly CONNECT events',
      'GROW coaching (2 sessions/mo)',
      '24/7 crisis hotline',
      'Dedicated account manager',
    ],
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    usd: 'Custom',
    kes: 'Custom',
    period: 'tailored to your needs',
    bestFor: '1,000+ staff',
    highlight: false,
    popular: false,
    headerBg: 'bg-[#000b3d]',
    priceBg: 'bg-[#f0e8d8]',
    priceColor: 'text-[#000b3d]',
    priceMeta: 'text-[#000b3d]/60',
    featureBg: 'bg-background',
    featureText: 'text-foreground',
    checkBg: 'border border-[#000b3d]/20 bg-background',
    checkColor: 'text-[#000b3d]/50',
    ctaBg: 'bg-[#000b3d] hover:bg-[#000b3d]/90 text-white',
    features: [
      'Full 3-pillar integration',
      'PEM system integration',
      'C-Suite wellness package',
      'Full CPD for your HR team',
      'Real-time analytics & ROI dash',
      'SLA-backed support',
    ],
  },
];

const pillars = [
  { icon: Users,         title: 'CONNECT',         body: 'Facilitated workshops, public events, and corporate wellness sessions embedded in everyday workspaces — normalising conversations about mental health before a crisis hits.' },
  { icon: Shield,        title: 'HEAL',             body: 'Licensed therapists for individual, couples, and group therapy — delivered online or in-person, matched by language, specialty, and cultural context.' },
  { icon: BarChart3,     title: 'GROW',             body: 'Executive coaching, leadership development, PEM integration, and CPD for HR teams — building lasting organisational resilience and wellbeing systems.' },
];

const partnerTypes = [
  { icon: Building2,    title: 'Corporations',        body: 'Employee Assistance Programmes, leadership coaching, and real-time wellbeing analytics for your workforce.' },
  { icon: Users,        title: 'NGOs & Civil Society', body: 'Community mental health resilience programmes and staff wellness support for field teams.' },
  { icon: Shield,       title: 'Government Bodies',   body: 'Policy consultation, public-facing mental health campaigns, and system-level integration.' },
  { icon: GraduationCap, title: 'Research & Academic', body: 'Collaborative studies, data partnerships, and CPD certification programmes.' },
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

  const inputCls = 'w-full rounded-lg px-4 py-2.5 font-ui text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-[#000b3d]/60 transition-colors';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-[#000b3d]">
            {status === 'done' ? 'Enquiry received' : `${plan.name} Plan — Get Started`}
          </DialogTitle>
        </DialogHeader>

        {status === 'done' ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-[#000b3d] mx-auto" />
            <p className="font-body text-base text-[#000b3d]">
              Thanks, {fields.companyName}! Our team will be in touch with you at <strong>{fields.email}</strong> within 24 hours.
            </p>
            <Button onClick={() => { reset(); onClose(); }} className="font-ui rounded-full bg-[#000b3d] hover:bg-[#000b3d]/90 text-white">
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
              className="w-full font-ui rounded-full bg-[#000b3d] hover:bg-[#000b3d]/90 text-white disabled:opacity-60"
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
    <section className="relative py-28 bg-[#c8e6f7] overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#f0e8d8] translate-x-1/3 -translate-y-1/3 pointer-events-none opacity-60" />
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl">
          <div className="inline-block border border-[#000b3d]/20 rounded-full px-4 py-1.5 font-ui text-sm text-[#000b3d]/60 uppercase tracking-widest mb-8">
            Partnerships & Collaborations
          </div>
          <h1 className="font-display text-5xl md:text-7xl text-[#000b3d] leading-none mb-6">Grow</h1>
          <p className="font-body text-xl text-[#000b3d]/70 leading-relaxed max-w-2xl mb-10">
            Partner with Nawe to bring structured, evidence-based mental health support to your organisation, community, or institution. We work with corporations, NGOs, governments, and research partners across Africa.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="mailto:connect@nawe.co.ke?subject=Partnership%20Enquiry">
              <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-[#000b3d] hover:bg-[#000b3d]/90 text-white shadow-soft">
                <Mail className="mr-2 h-5 w-5" /> Get in Touch
              </Button>
            </a>
            <a href="#pricing">
              <Button size="lg" variant="outline" className="font-ui text-base px-8 py-6 rounded-full border-[#000b3d]/30 text-[#000b3d] hover:bg-[#000b3d]/8">
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
        <h2 className="font-display text-5xl md:text-6xl text-[#000b3d] mb-14">The Three-Pillar Model</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((p) => (
            <div key={p.title} className="bg-[#c8e6f7] rounded-card p-8 flex flex-col gap-4">
              <p.icon className="h-6 w-6 text-[#000b3d]/50" />
              <h3 className="font-display text-2xl text-[#000b3d]">{p.title}</h3>
              <p className="font-body text-base text-[#000b3d]/70 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* PARTNER TYPES */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">Who We Work With</div>
        <h2 className="font-display text-5xl md:text-6xl text-foreground mb-14">Partnership Types</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {partnerTypes.map((p) => (
            <div key={p.title} className="bg-background border border-border rounded-card p-7 flex gap-5 shadow-card">
              <div className="w-12 h-12 rounded-full bg-[#c8e6f7] flex items-center justify-center shrink-0">
                <p.icon className="h-5 w-5 text-[#000b3d]" />
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
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-6">Corporate Packages</div>
        <h2 className="font-display text-5xl md:text-6xl text-[#000b3d] mb-2">Corporate Packages & Pricing</h2>
        <p className="font-body text-lg text-muted-foreground italic mb-14">Flexible, transparent pricing — designed for Kenyan organisations of every size</p>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div key={plan.id} className="relative pt-10">
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <span className="font-ui text-xs font-bold px-4 py-1.5 rounded-full bg-[#000b3d] text-[#c8e6f7] uppercase tracking-widest shadow-soft">Most Popular</span>
                </div>
              )}
              <div className={`rounded-card overflow-hidden border shadow-card ${plan.highlight ? 'border-[#000b3d] shadow-soft' : 'border-border'}`}>
              {/* Header */}
              <div className={`${plan.headerBg} px-8 text-center ${plan.popular ? 'pt-8 pb-5' : 'py-5'}`}>
                <h3 className="font-ui text-sm font-bold text-white uppercase tracking-widest">{plan.name}</h3>
              </div>
              {/* Price block */}
              <div className={`${plan.priceBg} px-8 py-8 text-center border-b border-black/10`}>
                <p className={`font-display text-5xl font-bold ${plan.priceColor} mb-1`}>{plan.usd}</p>
                <p className={`font-ui text-sm ${plan.priceMeta} mb-1`}>{plan.kes}</p>
                <p className={`font-ui text-sm ${plan.priceMeta} italic`}>{plan.period}</p>
                <p className={`font-ui text-xs mt-3 ${plan.priceMeta} italic`}>Best for: {plan.bestFor}</p>
              </div>
              {/* Features */}
              <div className={`px-8 py-6 space-y-3 ${plan.featureBg}`}>
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
                <Button onClick={() => setSelectedPlan(plan)} className={`w-full font-ui rounded-full ${plan.ctaBg}`}>
                  {plan.id === 'enterprise' ? 'Contact Us' : 'Get Started'}
                </Button>
              </div>
              </div>
            </div>
          ))}
        </div>

        {/* All plans include */}
        <div className="mt-8 bg-[#f7f0e8] border border-[#eaccac]/40 rounded-card px-8 py-4">
          <p className="font-ui text-sm text-[#000b3d]/70 text-center">
            <span className="font-semibold text-[#000b3d]">All plans include: </span>
            {includedAll.join(' • ')}
          </p>
        </div>
      </div>
    </section>

    {/* CTA BANNER */}
    <section className="py-24 bg-[#c8e6f7]">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <DollarSign className="h-10 w-10 text-[#000b3d]/40 mx-auto mb-6" />
          <h2 className="font-display text-4xl md:text-5xl text-[#000b3d] mb-4">Ready to invest in your people?</h2>
          <p className="font-body text-lg text-[#000b3d]/70 mb-8 leading-relaxed">
            Let's build a mental health programme that fits your organisation's size, budget, and goals.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="mailto:connect@nawe.co.ke?subject=Partnership%20Enquiry">
              <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-[#000b3d] hover:bg-[#000b3d]/90 text-white shadow-soft">
                <Mail className="mr-2 h-5 w-5" /> Get in Touch
              </Button>
            </a>
            <Link to="/">
              <Button size="lg" variant="outline" className="font-ui text-base px-8 py-6 rounded-full border-[#000b3d]/30 text-[#000b3d] hover:bg-[#000b3d]/8">
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
