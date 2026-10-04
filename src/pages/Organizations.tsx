import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Audience page: organisations. Built from existing content (Grow's packages
// and enquiry dialog, leadership and team offerings). The assessment enquiry
// is handled by the existing dialog on /grow, so this page does not duplicate it.

const cycle = [
  { title: 'Measure', body: 'Wellbeing, workload, leadership, psychological safety, engagement and team effectiveness.' },
  { title: 'Understand', body: 'Findings turned into organisational insight and a short list of clear priorities.' },
  { title: 'Act', body: 'Leadership and manager development, executive coaching, team work and targeted support.' },
  { title: 'Measure again', body: 'Follow-up that shows whether the change is real and lasting.' },
];

const offers = [
  'Organisational health assessment',
  'Leadership and manager development',
  'Executive and one-to-one coaching',
  'Team effectiveness and psychological safety',
  'Employee wellbeing support',
];

const Organizations = () => (
  <div>
    {/* Intro */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="font-ui text-sm uppercase tracking-widest text-muted-foreground mb-6">For organisations</p>
          <h1 className="font-display text-5xl md:text-6xl text-brand-navy leading-tight mb-6">
            Your people are your organisation.
          </h1>
          <p className="font-body text-xl text-foreground leading-relaxed mb-10">
            Healthy organisations start with understanding people. Nawe begins with structured assessment and workforce insight, designs the interventions that fit what it finds, and measures whether they worked.
          </p>
          <Link to="/grow">
            <Button size="lg" className="font-ui text-lg px-8 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Request an assessment <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
        <img
          src="/site-revamp/team_session.webp"
          alt="A diverse team in a meeting around a conference table"
          className="w-full rounded-card object-cover aspect-[4/3]"
          loading="eager"
        />
      </div>
    </section>

    {/* The cycle */}
    <section className="py-24 bg-brand-navy text-white">
      <div className="container mx-auto px-6">
        <p className="font-ui text-sm uppercase tracking-widest text-white/60 mb-4">How it works</p>
        <h2 className="font-display text-4xl md:text-5xl mb-14 max-w-2xl">Measure, understand, act, and measure again</h2>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cycle.map((step, i) => (
            <li key={step.title} className="border-t border-white/25 pt-6 flex flex-col gap-3">
              <span className="font-ui text-sm font-medium text-white/60">Step {i + 1}</span>
              <h3 className="font-display text-2xl">{step.title}</h3>
              <p className="font-body text-base text-white/75 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    {/* What we offer */}
    <section className="py-24 bg-brand-sky">
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div>
          <p className="font-ui text-sm uppercase tracking-widest text-brand-navy/60 mb-4">What we offer</p>
          <h2 className="font-display text-4xl md:text-5xl text-brand-navy">Interventions that fit what we find</h2>
        </div>
        <ul className="font-body text-xl text-brand-navy space-y-3">
          {offers.map((o) => <li key={o} className="border-b border-brand-navy/20 pb-3">{o}</li>)}
        </ul>
      </div>
    </section>

    {/* Packages and enquiry */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/grow" className="group rounded-card border border-border p-10 flex flex-col gap-4 hover:bg-brand-sand/50 transition-colors">
          <h3 className="font-display text-3xl text-foreground">Packages and pricing</h3>
          <p className="font-body text-lg text-muted-foreground">Corporate packages for teams of different sizes, with clear pricing.</p>
          <span className="font-ui font-medium text-primary mt-auto group-hover:underline">View packages →</span>
        </Link>
        <Link to="/grow" className="group rounded-card border border-border p-10 flex flex-col gap-4 hover:bg-brand-sand/50 transition-colors">
          <h3 className="font-display text-3xl text-foreground">Talk to our team</h3>
          <p className="font-body text-lg text-muted-foreground">Tell us about your organisation and what you want to strengthen.</p>
          <span className="font-ui font-medium text-primary mt-auto group-hover:underline">Start an enquiry →</span>
        </Link>
      </div>
    </section>

    {/* Closing */}
    <section className="py-24 bg-brand-sand text-center">
      <div className="container mx-auto px-6 max-w-2xl">
        <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-6">Invest in your people.</h2>
        <p className="font-body text-xl text-brand-navy/70 mb-10">Start with an assessment and see where your organisation stands.</p>
        <Link to="/grow">
          <Button size="lg" className="font-ui text-lg px-10 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Request an assessment <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </section>
  </div>
);

export default Organizations;
