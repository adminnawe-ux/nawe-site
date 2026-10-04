import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Audience page: individuals and families. Built from existing pathways
// (triage, matches, resources, questionnaire); no new services.

const steps = [
  { title: 'Tell us what is going on', body: 'A short, private questionnaire about what you are facing and what kind of support feels right.' },
  { title: 'Get matched', body: 'We suggest licensed therapists who fit your needs, language and preferences.' },
  { title: 'Choose your therapist', body: 'Read profiles, compare, and pick the person you feel most comfortable with.' },
  { title: 'Start when you are ready', body: 'Book online or in person, with transparent pricing and no surprises.' },
];

const People = () => (
  <div>
    {/* Intro */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="font-ui text-sm uppercase tracking-widest text-muted-foreground mb-6">For individuals and families</p>
          <h1 className="font-display text-5xl md:text-6xl text-brand-navy leading-tight mb-6">
            Life doesn't always come with a clear roadmap.
          </h1>
          <p className="font-body text-xl text-foreground leading-relaxed mb-10">
            Whatever brought you here, you don't have to figure it out alone. Nawe helps you find professional care, practical resources and people who understand.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/questionnaire">
              <Button size="lg" className="font-ui text-lg px-8 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Find support <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/triage">
              <Button size="lg" variant="outline" className="font-ui text-lg px-8 py-6 rounded-full border-brand-navy/30 text-brand-navy">
                Talk to our triage
              </Button>
            </Link>
          </div>
        </div>
        <img
          src="/site-revamp/family_pathway.webp"
          alt="A mother and her son walking together along a tree-lined street"
          className="w-full rounded-card object-cover aspect-[4/3]"
          loading="eager"
        />
      </div>
    </section>

    {/* How support works */}
    <section className="py-24 bg-brand-sky">
      <div className="container mx-auto px-6">
        <p className="font-ui text-sm uppercase tracking-widest text-brand-navy/60 mb-4">How it works</p>
        <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-14 max-w-2xl">
          From first question to first session
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <li key={step.title} className="bg-white rounded-card p-8 flex flex-col gap-4">
              <span className="font-ui text-sm font-medium text-primary">Step {i + 1}</span>
              <h3 className="font-display text-2xl text-brand-navy">{step.title}</h3>
              <p className="font-body text-base text-brand-navy/70 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    {/* Resources and directory */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/resources" className="group rounded-card border border-border p-10 flex flex-col gap-4 hover:bg-brand-sand/50 transition-colors">
          <h3 className="font-display text-3xl text-foreground">Resources between sessions</h3>
          <p className="font-body text-lg text-muted-foreground">Articles, guided exercises and coping tools you can use right now.</p>
          <span className="font-ui font-medium text-primary mt-auto group-hover:underline">Browse resources →</span>
        </Link>
        <Link to="/matches" className="group rounded-card border border-border p-10 flex flex-col gap-4 hover:bg-brand-sand/50 transition-colors">
          <h3 className="font-display text-3xl text-foreground">Browse therapists</h3>
          <p className="font-body text-lg text-muted-foreground">See licensed therapists by specialty, language and location before you sign up.</p>
          <span className="font-ui font-medium text-primary mt-auto group-hover:underline">View therapists →</span>
        </Link>
      </div>
    </section>

    {/* Closing */}
    <section className="py-24 bg-brand-sky text-center">
      <div className="container mx-auto px-6 max-w-2xl">
        <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-6">You don't have to figure it out alone.</h2>
        <p className="font-body text-xl text-brand-navy/70 mb-10">Nawe is with you, every step.</p>
        <Link to="/questionnaire">
          <Button size="lg" className="font-ui text-lg px-10 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Find support <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </section>
  </div>
);

export default People;
