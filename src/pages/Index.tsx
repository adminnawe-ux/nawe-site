import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight, Star, Users, Shield, Globe, Laptop, Building2,
  BookOpen, Heart, MapPin, Handshake, GraduationCap, Landmark,
  Video, DollarSign,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

const pillars = [
  { icon: DollarSign, title: 'Standardized', sub: 'Transparent Pricing' },
  { icon: Shield,     title: 'Vetted',        sub: 'Licensed Therapists' },
  { icon: Laptop,     title: 'Digital',       sub: 'Accessible Platform' },
];

const stats = [
  { value: '20+',    label: 'Licensed Therapists' },
  { value: '1,000+', label: 'Sessions Completed' },
  { value: '6+',     label: 'Countries' },
  { value: '4.8/5',  label: 'Average Rating' },
];

const services = [
  { icon: Users,      title: 'Therapist Matching',      body: 'Smart matching connects you to the right licensed therapist based on specialisation, language, and personal preference.' },
  { icon: Video,      title: 'Online & In-Person',      body: 'Flexible session formats — video, phone, or in-person — to meet clients where they are. No commute, no barriers.' },
  { icon: DollarSign, title: 'Standardized Pricing',    body: 'Transparent, equitable pricing so quality mental health support is affordable. No hidden fees, no guesswork.' },
  { icon: Globe,      title: 'Cultural Competence',     body: "Our therapists provide culturally sensitive care, reflecting Africa's diverse languages, identities, and lived experiences." },
  { icon: BookOpen,   title: 'Mental Health Resources', body: 'Curated articles, tools, and self-help resources to support wellbeing between therapy sessions.' },
  { icon: Building2,  title: 'Corporate Wellness',      body: 'Employee mental health packages for organisations, helping companies build healthier, more resilient workforces.' },
];

const steps = [
  { n: '01', title: 'Create Profile',        body: 'Sign up and share your preferences, needs, and language — in minutes.' },
  { n: '02', title: 'Get Matched',           body: 'Our platform suggests vetted therapists that fit your unique profile.' },
  { n: '03', title: 'Choose Your Therapist', body: 'Browse profiles, read bios, and select the therapist you feel best with.' },
  { n: '04', title: 'Book a Session',        body: 'Schedule online or in-person at a time that works for you.' },
  { n: '05', title: 'Start Your Journey',    body: 'Begin therapy with transparent, standardized pricing — no surprises.' },
];

const regions = [
  { name: 'East Africa (HQ)',  countries: 'Kenya, Uganda, Tanzania',   status: 'Active',      statusClass: 'bg-primary/10 text-primary' },
  { name: 'West Africa',       countries: 'Nigeria, Ghana',            status: 'Expanding',   statusClass: 'bg-accent/10 text-accent' },
  { name: 'Southern Africa',   countries: 'South Africa, Zimbabwe',    status: 'Pilot Phase', statusClass: 'bg-muted text-muted-foreground' },
  { name: 'Online / Diaspora', countries: 'Global reach via platform', status: 'Active',      statusClass: 'bg-primary/10 text-primary' },
];

const partners = [
  { icon: Landmark,     title: 'Government',           body: 'County health departments, Ministry of Health — Kenya & Uganda' },
  { icon: Globe,        title: 'Health Organizations', body: 'WHO Africa, Africa CDC, APHRC, local mental health boards' },
  { icon: GraduationCap, title: 'Academic & Research', body: 'University of Nairobi, Makerere University, KNH Research Unit' },
  { icon: Handshake,    title: 'NGO & Civil Society',  body: "Mental health advocacy groups, women's rights organisations, refugee support networks" },
  { icon: Building2,    title: 'Private Sector',       body: 'Corporate wellness programs, health insurance providers, tech partners' },
  { icon: Heart,        title: 'Funders & Donors',     body: 'Impact investors, development finance institutions, health-focused foundations' },
];

const resources = [
  { n: '1', title: 'Mental Health Blog',  body: 'Evidence-based articles on anxiety, depression, relationships, grief, and trauma — written by our therapists.' },
  { n: '2', title: 'Self-Help Toolkit',   body: 'Guided exercises, mood trackers, and coping strategies you can use between sessions.' },
  { n: '3', title: 'Therapist Directory', body: 'Browse licensed therapists by specialty, language, and location before you even sign up.' },
  { n: '4', title: 'Policy & Research',   body: 'White papers and policy briefs on mental health equity in Sub-Saharan Africa, in collaboration with academic partners.' },
];

const testimonials = [
  { text: '"Nawe helped me find a therapist who truly understands my culture and my struggles. I finally feel heard."', name: 'Sarah M.', location: 'Nairobi' },
  { text: '"The matching process was so gentle and thoughtful. Within a week, I had my first session and it changed everything."', name: 'James K.', location: 'Qatar' },
  { text: '"I was nervous about starting therapy. Nawe made it feel safe and welcoming from the very first step."', name: 'Amina R.', location: 'Kampala' },
];

// ─── Newsletter ──────────────────────────────────────────────────────────────

const NewsletterPanel = () => {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setState('loading');
    const { error } = await supabase.functions.invoke('subscribe-newsletter', {
      body: { email: email.trim(), source: 'landing_page' },
    });
    if (error) {
      setErrorMsg('Something went wrong. Please try again.');
      setState('error');
    } else {
      setState('done');
    }
  };

  return (
    <div className="bg-foreground rounded-card p-8 flex flex-col gap-6">
      <div>
        <h3 className="font-display text-2xl text-background mb-3">Stay Informed</h3>
        <p className="font-body text-sm text-background/70 leading-relaxed">
          Subscribe to our newsletter for the latest mental health research, therapist insights, and community stories from across Africa.
        </p>
      </div>
      {state === 'done' ? (
        <p className="font-ui text-sm text-primary text-center py-4">You're subscribed! We'll be in touch.</p>
      ) : (
        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Your email address"
            className="w-full rounded-full px-4 py-3 font-ui text-sm bg-background/10 border border-background/20 text-background placeholder:text-background/50 outline-none focus:border-background/60"
          />
          {state === 'error' && (
            <p className="font-ui text-xs text-destructive text-center">{errorMsg}</p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={state === 'loading'}
            className="w-full font-ui rounded-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-60"
          >
            {state === 'loading' ? 'Subscribing…' : <>Subscribe Now <ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

const Index = () => (
  <div>

    {/* 1 · HERO ─────────────────────────────────────────────────────────── */}
    <section className="relative min-h-screen flex items-center overflow-hidden bg-primary">
      <div className="absolute inset-0 -z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary-foreground/5 translate-x-1/3 -translate-y-1/4" />
        <div className="absolute bottom-0 right-20 w-[280px] h-[280px] rounded-full bg-primary-foreground/10 translate-y-1/4" />
      </div>
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl animate-fade-in">
          <p className="font-ui text-primary-foreground/70 text-sm uppercase tracking-widest mb-8">
            Equitable Access to Mental Health Care Across Africa
          </p>
          <h1 className="font-display text-7xl md:text-9xl text-primary-foreground leading-none mb-2">
            Find Your Calm.
          </h1>
          <h1 className="font-display text-7xl md:text-9xl text-primary-foreground/80 leading-none mb-10">
            Find Your Person.
          </h1>
          <p className="font-body text-xl md:text-2xl text-primary-foreground/80 mb-12 max-w-2xl leading-relaxed">
            Connect with licensed, culturally-competent therapists who understand you — wherever you are in Africa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/questionnaire">
              <Button size="lg" className="font-ui text-lg px-10 py-7 rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-soft">
                Find a Therapist <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="outline" size="lg" className="font-ui text-lg px-10 py-7 rounded-full bg-transparent border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground/10">
                How It Works
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>

    {/* 2 · WHAT IS NAWE ─────────────────────────────────────────────────── */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1 font-ui text-xs text-muted-foreground uppercase tracking-widest mb-8">Overview</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-display text-4xl md:text-5xl text-foreground mb-6">What is Nawe?</h2>
            <p className="font-body text-lg text-foreground mb-4 leading-relaxed">
              <span className="text-primary font-semibold">Nawe</span> is a social enterprise and digital platform that increases equitable access to quality mental health care by matching people to therapists of choice — with <span className="text-primary font-semibold">standardized, transparent pricing.</span>
            </p>
            <p className="font-body text-muted-foreground leading-relaxed italic">
              We believe that mental health is a right, not a privilege. Nawe removes the barriers of cost, stigma, and access — connecting individuals across Africa with licensed, culturally-competent therapists through a seamless digital experience.
            </p>
          </div>
          <div className="space-y-4">
            {pillars.map((p) => (
              <div key={p.title} className="flex items-center gap-4 bg-card border border-border rounded-card p-5 shadow-card">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-display text-foreground">{p.title}</p>
                  <p className="font-body text-sm text-muted-foreground">{p.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
          {stats.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-card p-6 text-center shadow-card">
              <p className="font-display text-3xl text-primary mb-1">{s.value}</p>
              <p className="font-ui text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 3 · OUR STORY & MISSION ──────────────────────────────────────────── */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1 font-ui text-xs text-muted-foreground uppercase tracking-widest mb-8">About Us</div>
        <h2 className="font-display text-4xl md:text-5xl text-foreground mb-10">Our Story & Mission</h2>
        <blockquote className="border-l-4 border-primary bg-background rounded-card p-8 mb-10">
          <p className="font-body text-lg text-foreground italic leading-relaxed">
            "To eliminate barriers to mental health care by making quality, affordable, and culturally-sensitive therapy accessible to every person across Africa."
          </p>
        </blockquote>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Who We Are',   body: 'Nawe is a Kenyan-based social enterprise founded to address the critical gap in mental health care access across Sub-Saharan Africa. We combine technology, public health expertise, and a deep commitment to equity.' },
            { label: 'The Problem',  body: 'Over 75% of people with mental health conditions in Africa receive no treatment. High costs, limited providers, stigma, and geographic barriers leave millions without support.' },
            { label: 'Our Solution', body: 'A digital matching platform that connects clients to therapists of their choice with standardized pricing, flexible scheduling, and multilingual support — bridging the access gap at scale.' },
          ].map((c) => (
            <div key={c.label} className="bg-background border border-border rounded-card overflow-hidden shadow-card">
              <div className="bg-foreground px-5 py-3 font-ui text-sm font-medium text-background">{c.label}</div>
              <p className="font-body text-sm text-muted-foreground p-5 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 4 · SERVICES ─────────────────────────────────────────────────────── */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1 font-ui text-xs text-muted-foreground uppercase tracking-widest mb-8">Services</div>
        <h2 className="font-display text-4xl md:text-5xl text-foreground mb-12">What We Offer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s) => (
            <div key={s.title} className="bg-card border border-border rounded-card p-6 shadow-card hover:shadow-soft transition-shadow">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-foreground mb-2">{s.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 5 · HOW IT WORKS ─────────────────────────────────────────────────── */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1 font-ui text-xs text-muted-foreground uppercase tracking-widest mb-8">How It Works</div>
        <h2 className="font-display text-4xl md:text-5xl text-foreground mb-16">Your Journey to Better Mental Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-border -translate-y-1/2 z-0" />
              )}
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center mb-4">
                  <span className="font-ui text-sm font-bold text-primary">{s.n}</span>
                </div>
                <p className="font-display text-foreground mb-2">{s.title}</p>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12">
          <Link to="/questionnaire">
            <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>

    {/* 6 · WHERE WE WORK ────────────────────────────────────────────────── */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1 font-ui text-xs text-muted-foreground uppercase tracking-widest mb-8">Where We Work</div>
        <h2 className="font-display text-4xl md:text-5xl text-foreground mb-4">Our Reach Across Africa</h2>
        <p className="font-body text-muted-foreground mb-12">Headquartered in Nairobi, Kenya · Licensed therapists operating in 6+ countries · Expanding continuously</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {regions.map((r) => (
            <div key={r.name} className="bg-card border border-border rounded-card p-6 shadow-card">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-display text-foreground">{r.name}</h3>
                <span className={`font-ui text-xs px-3 py-1 rounded-full ${r.statusClass}`}>{r.status}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <p className="font-body text-sm">{r.countries}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 7 · PARTNERSHIPS ─────────────────────────────────────────────────── */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1 font-ui text-xs text-muted-foreground uppercase tracking-widest mb-8">Partnerships</div>
        <h2 className="font-display text-4xl md:text-5xl text-foreground mb-4">Partnerships & Collaborations</h2>
        <p className="font-body text-muted-foreground mb-12 max-w-2xl">
          Nawe works alongside governments, NGOs, research institutions, and private sector partners to extend our reach and deepen our impact.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((p) => (
            <div key={p.title} className="bg-background border border-border rounded-card p-6 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <p.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-display text-foreground">{p.title}</h3>
              </div>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 8 · RESOURCES ────────────────────────────────────────────────────── */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1 font-ui text-xs text-muted-foreground uppercase tracking-widest mb-8">Resources</div>
        <h2 className="font-display text-4xl md:text-5xl text-foreground mb-12">Resources & Knowledge Hub</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-4">
            {resources.map((r) => (
              <div key={r.n} className="flex gap-5 bg-card border border-border rounded-card p-5 shadow-card">
                <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
                  <span className="font-ui text-sm font-bold text-primary">{r.n}</span>
                </div>
                <div>
                  <h3 className="font-display text-foreground mb-1">{r.title}</h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
          <NewsletterPanel />
        </div>
      </div>
    </section>

    {/* 9 · TESTIMONIALS ─────────────────────────────────────────────────── */}
    <section className="py-24 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <h2 className="font-display text-4xl md:text-5xl text-foreground text-center mb-14">Stories from our community</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-background rounded-card p-8 shadow-card border border-border">
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} className="h-4 w-4 fill-warning text-warning" />
                ))}
              </div>
              <p className="font-body text-foreground italic leading-relaxed mb-6">{t.text}</p>
              <div>
                <p className="font-ui text-sm font-medium text-foreground">{t.name}</p>
                <p className="font-ui text-xs text-muted-foreground">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 10 · FINAL CTA ───────────────────────────────────────────────────── */}
    <section className="py-24 bg-foreground">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <Heart className="h-10 w-10 text-primary mx-auto mb-6" />
          <h2 className="font-display text-4xl md:text-5xl text-background mb-4">
            Your journey starts with one step
          </h2>
          <p className="font-body text-background/70 mb-8 max-w-lg mx-auto leading-relaxed">
            You don't have to figure this out alone. Let us help you find a therapist who understands.
          </p>
          <Link to="/questionnaire">
            <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
              Find a Therapist <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>

  </div>
);

export default Index;
