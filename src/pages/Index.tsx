import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight, Star, Users, Globe, Building2,
  BookOpen, Heart, MapPin, GraduationCap,
  Video, DollarSign, Mail,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────


const stats = [
  { value: '20+',    label: 'Licensed Therapists' },
  { value: '1,000+', label: 'Sessions Completed' },
  { value: '3+',     label: 'Countries' },
  { value: '4.8/5',  label: 'Average Rating' },
];

const services = [
  // { icon: Users,      title: 'Therapist Matching',      body: 'Smart matching connects you to the right licensed therapist based on specialisation, language, and personal preference.' },
  // { icon: Video,      title: 'Online & In-Person',      body: 'Flexible session formats — video, phone, or in-person — to meet clients where they are. No commute, no barriers.' },
  // { icon: DollarSign, title: 'Standardized Pricing',    body: 'Transparent, equitable pricing so quality mental health support is affordable. No hidden fees, no guesswork.' },
  // { icon: Globe,      title: 'Cultural Competence',     body: "Our therapists provide culturally sensitive care, reflecting Africa's diverse languages, identities, and lived experiences." },
  // { icon: BookOpen,   title: 'Mental Health Resources', body: 'Curated articles, tools, and self-help resources to support wellbeing between therapy sessions.' },
  // { icon: Building2,  title: 'Corporate Wellness',      body: 'Employee mental health packages for organisations, helping companies build healthier, more resilient workforces.' },
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
        <p className="font-body text-base text-background/70 leading-relaxed">
          Subscribe to our newsletter for the latest mental health research, therapist insights, and community stories from across Africa.
        </p>
      </div>
      {state === 'done' ? (
        <p className="font-ui text-base text-primary text-center py-4">You're subscribed! We'll be in touch.</p>
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
            <p className="font-ui text-sm text-destructive text-center">{errorMsg}</p>
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
            Connect  - Heal - Grow
          </p>
          <h1 className="font-display text-7xl md:text-9xl text-primary-foreground leading-none mb-2">
            With you,
          </h1>
            <h1 className="font-display text-7xl md:text-9xl text-primary-foreground leading-none mb-2">
            Every step.
          </h1>
          {/* <p className="font-body text-xl md:text-2xl text-primary-foreground/80 mb-12 max-w-2xl leading-relaxed">
            Nawe means 'with you' in Swahili. 
          </p> */}
          <div>
            <p className="font-ui text-sm text-primary-foreground/60 uppercase tracking-widest mb-4">I'm here as a...</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/questionnaire">
                <button className="font-ui text-base px-6 py-3 rounded-full border border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/15 transition-colors">
                  Individual 
                </button>
              </Link>
              <Link to="/for-therapists">
                <button className="font-ui text-base px-6 py-3 rounded-full border border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/15 transition-colors">
                  Therapist 
                </button>
              </Link>
              <Link to="/how-it-works">
                <button className="font-ui text-base px-6 py-3 rounded-full border border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/15 transition-colors">
                  Corporate 
                </button>
              </Link>
              <a href="/#partnerships">
                <button className="font-ui text-base px-6 py-3 rounded-full border border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/15 transition-colors">
                  Partner
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* 2 · WHAT IS NAWE ─────────────────────────────────────────────────── */}
    <section className="py-28 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">Overview</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-display text-5xl md:text-6xl text-foreground mb-8">Who we Are</h2>
            <p className="font-body text-xl text-foreground mb-5 leading-relaxed">
              <span className="text-primary font-semibold">Nawe</span> a social enterprise making mental wellbeing accessible to every African through  <span className="text-primary font-semibold">trusted, community-centered, and technology-enabled care.</span>
            </p>
            <p className="font-body text-lg text-muted-foreground leading-relaxed italic">
            We walk with individuals, organizations, and communities to build healthier lives, stronger institutions, and more resilient societies.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-px bg-primary" />
              <span className="font-ui text-xs text-primary uppercase tracking-widest">Start Here</span>
            </div>
            <p className="font-display text-2xl text-foreground leading-snug mb-6">Wherever you're starting from, there's a path for you.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Heart,      title: 'Individuals & Families ',   body: 'Book a confidential session with a licensed therapist.',           cta: 'Find a therapist',  href: '/questionnaire' },
                { icon: Building2,  title: 'Corporate',     body: 'Give your teams structured, confidential wellbeing support.',     cta: 'See pricing tiers', href: '/how-it-works' },
                { icon: Users,      title: 'Licensed therapists',      body: 'Build your practice and get matched with clients.',                cta: 'Apply to join',     href: '/for-therapists' },
                { icon: Globe,      title: 'Partners', body: 'Bring resilience programmes into your community.',                 cta: 'Partner with us',   href: '/#partnerships' },
              ].map((card) => (
                <a key={card.title} href={card.href} className="group flex flex-col gap-3 bg-card border border-border rounded-card p-5 hover:border-primary/40 hover:shadow-card transition-all">
                  <card.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="font-display text-base text-foreground">{card.title}</p>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed flex-1">{card.body}</p>
                  <span className="font-ui text-sm text-primary">{card.cta} →</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
          {stats.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-card p-8 text-center shadow-card">
              <p className="font-display text-5xl text-primary mb-2">{s.value}</p>
              <p className="font-ui text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 3 · OUR STORY & MISSION ──────────────────────────────────────────── */}
    <section className="py-28 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">About Us</div>
        <h2 className="font-display text-5xl md:text-6xl text-foreground mb-10">Our Mission </h2>
        <blockquote className="border-l-4 border-primary bg-background rounded-card p-8 mb-10">
          <p className="font-body text-xl text-foreground italic leading-relaxed">
            "To provide equitable access to quality and culturally grounded mental healthcare across Africa through scalable systems, community-centered support, and digital innovation, leading to healthier individuals, stronger institutions, and more resilient communities.</p>
        </blockquote>
        <div className="space-y-16 mt-2">

          {/* CONNECT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch rounded-card overflow-hidden border border-border shadow-card">
            <div className="bg-foreground p-10 flex flex-col justify-between">
              <h3 className="font-display text-5xl md:text-6xl text-background mb-6">Connect</h3>
              <p className="font-body text-base text-background/70 leading-relaxed">Mental health care does not start in a clinic. It starts in the places people already gather: offices, schools, places of worship, WhatsApp groups. CONNECT brings facilitated workshops, public events and corporate wellness sessions into those everyday spaces, so asking for help becomes normal long before someone is in crisis.</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border">
              {[
                { icon: Users,     title: 'Community Workshops',      body: 'Facilitated mental health sessions in workplaces, schools, and community spaces.' },
                { icon: Building2, title: 'Corporate Wellness Events', body: 'Structured wellbeing days, awareness campaigns, and manager training.' },
                { icon: Globe,     title: 'Public Events',             body: 'Mental health talks, panel discussions, and awareness drives open to all.' },
                { icon: Heart,     title: 'Peer Support Groups',       body: 'Moderated peer communities for ongoing connection and shared experience.' },
              ].map((c) => (
                <div key={c.title} className="bg-card p-6 flex flex-col gap-3">
                  <c.icon className="h-5 w-5 text-muted-foreground" />
                  <p className="font-display text-base text-foreground">{c.title}</p>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>

    {/* 4 · SERVICES ─────────────────────────────────────────────────────── */}
    <section className="py-28 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">Services</div>
        <h2 className="font-display text-5xl md:text-6xl text-foreground mb-14">What We Offer</h2>


        {/* HEAL — below What We Offer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch rounded-card overflow-hidden border border-border shadow-card mt-20">
          <div className="bg-foreground p-10 flex flex-col justify-between">
            <h3 className="font-display text-5xl md:text-6xl text-background mb-6">Heal</h3>
            <p className="font-body text-base text-background/70 leading-relaxed">We help individuals, families and communities heal from life's challenges through evidence-based psychological care. We provide compassionate support to help you heal, cope, and move forward. Healing minds strengthens lives. We are here to support your healing journey, one step at a time.</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            {[
              { icon: Heart,    title: 'Therapist Matching',  body: 'Smart matching to licensed therapists by specialty, language, and price.' },
              { icon: Video,    title: 'Online Sessions',     body: 'Secure video or phone therapy from anywhere. No commute, no waiting room.' },
              { icon: MapPin,   title: 'In-Person Therapy',   body: 'Face-to-face sessions with local therapists in Nairobi, Kampala, Lagos.' },
              { icon: BookOpen, title: 'Self-Help Resources', body: 'Curated articles, mood trackers, and guided exercises between sessions.' },
            ].map((c) => (
              <div key={c.title} className="bg-card p-6 flex flex-col gap-3">
                <c.icon className="h-5 w-5 text-muted-foreground" />
                <p className="font-display text-base text-foreground">{c.title}</p>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {services.map((s) => (
            <div key={s.title} className="bg-card border border-border rounded-card p-7 shadow-card hover:shadow-soft transition-shadow">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl text-foreground mb-3">{s.title}</h3>
              <p className="font-body text-base text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 5 · HOW IT WORKS ─────────────────────────────────────────────────── */}
    <section className="py-28 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">How It Works</div>
        <h2 className="font-display text-5xl md:text-6xl text-foreground mb-16">Your Journey to Better Mental Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-border -translate-y-1/2 z-0" />
              )}
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-full border-2 border-primary flex items-center justify-center mb-5">
                  <span className="font-ui text-base font-bold text-primary">{s.n}</span>
                </div>
                <p className="font-display text-lg text-foreground mb-2">{s.title}</p>
                <p className="font-body text-base text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14">
          <Link to="/questionnaire">
            <Button size="lg" className="font-ui text-lg px-10 py-7 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>

    {/* 6 · WHERE WE WORK ────────────────────────────────────────────────── */}
    <section className="py-28 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">Where We Work</div>
        <h2 className="font-display text-5xl md:text-6xl text-foreground mb-4">Our Reach Across Africa</h2>
        <p className="font-body text-lg text-muted-foreground mb-14">Headquartered in Nairobi, Kenya · Licensed therapists operating in 3+ countries · Expanding continuously</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {regions.map((r) => (
            <div key={r.name} className="bg-card border border-border rounded-card p-7 shadow-card">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-display text-xl text-foreground">{r.name}</h3>
                <span className={`font-ui text-sm px-3 py-1 rounded-full ${r.statusClass}`}>{r.status}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <p className="font-body text-base">{r.countries}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 7 · PARTNERSHIPS ─────────────────────────────────────────────────── */}
    <section id="partnerships" className="py-28 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">Partnerships</div>
        <h2 className="font-display text-5xl md:text-6xl text-foreground mb-4">Partnerships & Collaborations</h2>

        {/* GROW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch rounded-card overflow-hidden border border-border shadow-card mb-16 mt-10">
          <div className="bg-foreground p-10 flex flex-col justify-between">
            <h3 className="font-display text-5xl md:text-6xl text-background mb-6">Grow</h3>
            <p className="font-body text-lg text-muted-foreground mb-14 max-w-2xl"> Nawe works alongside governments, NGOs, research institutions, and private sector partners to extend our reach and deepen our impact.</p>
            <p className="font-body text-base text-background/70 leading-relaxed">GROW moves beyond a single session or workshop. It is one-on-one coaching, leadership development and organisational wellness systems for people and teams who want lasting change.</p>
            <p className="font-body text-base text-background/70 leading-relaxed">Nawe works alongside governments, NGOs, research institutions, and private sector partners to extend our reach and deepen our impact.</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            {[
              { icon: DollarSign,    title: 'PEM Integration',          body: 'Performance & Engagement Management wired into HR workflows with real-time wellbeing signals.' },
              { icon: Star,          title: 'C-Suite Wellness',          body: 'Bespoke executive coaching and confidential mental health support for senior leaders.' },
              { icon: Users,         title: 'Corporate Coaching',        body: 'Team coaching, leadership development, and resilience programs by certified coaches.' },
              { icon: GraduationCap, title: 'Therapist Training & CPD',  body: 'Continuous Professional Development, clinical supervision, and platform certification.' },
            ].map((c) => (
              <div key={c.title} className="bg-card p-6 flex flex-col gap-3">
                <c.icon className="h-5 w-5 text-muted-foreground" />
                <p className="font-display text-base text-foreground">{c.title}</p>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Partnership CTA */}
        <div className="bg-foreground rounded-card p-10 md:p-14 flex flex-col md:flex-row md:items-center gap-8">
          <div className="flex-1">
            <p className="font-ui text-sm text-background/50 uppercase tracking-widest mb-3">Work with us</p>
            <h3 className="font-display text-3xl md:text-4xl text-background mb-4">
              Bring mental health support to your organisation
            </h3>
            <p className="font-body text-base text-background/70 leading-relaxed max-w-xl">
              Whether you're a corporation building an employee wellness programme, an NGO serving a community, or a government body shaping mental health policy — we'd love to explore how Nawe can support your goals.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {['Corporate Wellness', 'NGO & Civil Society', 'Government', 'Research & Academic'].map(tag => (
                <span key={tag} className="font-ui text-xs px-3 py-1.5 rounded-full border border-background/20 text-background/60">{tag}</span>
              ))}
            </div>
          </div>
          <div className="shrink-0 flex flex-col gap-3 md:items-end">
            <a href="mailto:connect@nawe.co.ke?subject=Partnership%20Enquiry">
              <Button size="lg" className="font-ui text-base px-8 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft whitespace-nowrap">
                <Mail className="mr-2 h-5 w-5" /> Get in Touch
              </Button>
            </a>
            {/* <p className="font-ui text-xs text-background/40 md:text-right">connect@nawe.co.ke</p> */}
          </div>
        </div>
      </div>
    </section>

    {/* 8 · RESOURCES ────────────────────────────────────────────────────── */}
    <section className="py-28 bg-background">
      <div className="container mx-auto px-6">
        <div className="inline-block border border-border rounded-full px-4 py-1.5 font-ui text-sm text-muted-foreground uppercase tracking-widest mb-10">Resources</div>
        <h2 className="font-display text-5xl md:text-6xl text-foreground mb-14">Resources & Knowledge Hub</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-4">
            {resources.map((r) => (
              <div key={r.n} className="flex gap-5 bg-card border border-border rounded-card p-6 shadow-card">
                <div className="w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
                  <span className="font-ui text-base font-bold text-primary">{r.n}</span>
                </div>
                <div>
                  <h3 className="font-display text-xl text-foreground mb-2">{r.title}</h3>
                  <p className="font-body text-base text-muted-foreground leading-relaxed">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
          <NewsletterPanel />
        </div>
      </div>
    </section>

    {/* 9 · TESTIMONIALS ─────────────────────────────────────────────────── */}
    <section className="py-28 bg-card border-y border-border">
      <div className="container mx-auto px-6">
        <h2 className="font-display text-5xl md:text-6xl text-foreground text-center mb-16">Stories from our community</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-background rounded-card p-8 shadow-card border border-border">
              <div className="flex gap-1 mb-5">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} className="h-5 w-5 fill-warning text-warning" />
                ))}
              </div>
              <p className="font-body text-lg text-foreground italic leading-relaxed mb-6">{t.text}</p>
              <div>
                <p className="font-ui text-base font-medium text-foreground">{t.name}</p>
                <p className="font-ui text-sm text-muted-foreground">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* 10 · FINAL CTA ───────────────────────────────────────────────────── */}
    <section className="py-28 bg-foreground">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <Heart className="h-12 w-12 text-primary mx-auto mb-8" />
          <h2 className="font-display text-5xl md:text-6xl text-background mb-6">
            Your journey starts with one step
          </h2>
          <p className="font-body text-xl text-background/70 mb-10 max-w-lg mx-auto leading-relaxed">
            You don't have to figure this out alone. Let us help you find a therapist who understands.
          </p>
          <Link to="/questionnaire">
            <Button size="lg" className="font-ui text-lg px-10 py-7 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
              Find a Therapist <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>

  </div>
);

export default Index;
