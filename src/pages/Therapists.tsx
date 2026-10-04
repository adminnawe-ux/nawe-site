import { Link } from 'react-router-dom';
import { ArrowRight, Users, Shield, DollarSign, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Audience page: therapists, part of the professional network. Built from the
// existing ForTherapists content, reframed for the brief. Commission wording is
// kept as it stands and needs confirming against the current tiers.

const benefits = [
  { icon: Users, title: 'Client matching', body: 'We connect you with clients who are the right fit for your expertise.' },
  { icon: Shield, title: 'Verified platform', body: 'Your credentials are verified and displayed professionally.' },
  { icon: DollarSign, title: 'Secure payments', body: 'Get paid reliably by bank transfer, M-Pesa or Wise.' },
  { icon: Star, title: 'Build reputation', body: 'Collect verified reviews and grow your practice.' },
];

const Therapists = () => (
  <div>
    {/* Intro */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="font-ui text-sm uppercase tracking-widest text-muted-foreground mb-6">For therapists</p>
          <h1 className="font-display text-5xl md:text-6xl text-brand-navy leading-tight mb-6">
            Grow your practice. Change lives.
          </h1>
          <p className="font-body text-xl text-foreground leading-relaxed mb-10">
            Join a network of licensed professionals helping clients across East Africa and beyond. We handle the matching, scheduling and payments, so you can focus on what matters.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/therapist-signup">
              <Button size="lg" className="font-ui text-lg px-8 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Join the network <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="font-ui text-lg px-8 py-6 rounded-full border-brand-navy/30 text-brand-navy">
                Log in
              </Button>
            </Link>
          </div>
          <p className="font-ui text-sm text-muted-foreground mt-6">
            New therapist? Apply, then finish your profile after you confirm your email and sign in.
          </p>
        </div>
        <img
          src="/site-revamp/therapist.webp"
          alt="A smiling therapist seated in a book-lined room"
          className="w-full rounded-card object-cover aspect-[4/5] lg:aspect-square"
          loading="eager"
        />
      </div>
    </section>

    {/* Benefits */}
    <section className="py-24 bg-brand-sky">
      <div className="container mx-auto px-6">
        <p className="font-ui text-sm uppercase tracking-widest text-brand-navy/60 mb-4">Why join</p>
        <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-14 max-w-2xl">Focus on your clients. We handle the rest.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white rounded-card p-8 flex flex-col gap-4">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="font-display text-2xl text-brand-navy">{title}</h3>
              <p className="font-body text-base text-brand-navy/70 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Pricing */}
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="font-ui text-sm uppercase tracking-widest text-muted-foreground mb-4">Transparent pricing</p>
          <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-6">No hidden costs, no surprises.</h2>
          <p className="font-body text-xl text-foreground leading-relaxed">
            You keep 80% of every session fee. Payouts arrive on your schedule.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Link to="/therapist-signup" className="group rounded-card border border-border p-8 flex justify-between items-center hover:bg-brand-sand/50 transition-colors">
            <span className="font-display text-2xl text-foreground">Apply to join</span>
            <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/for-therapists" className="group rounded-card border border-border p-8 flex justify-between items-center hover:bg-brand-sand/50 transition-colors">
            <span className="font-display text-2xl text-foreground">Read the full details</span>
            <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>

    {/* Closing */}
    <section className="py-24 bg-brand-sand text-center">
      <div className="container mx-auto px-6 max-w-2xl">
        <h2 className="font-display text-4xl md:text-5xl text-brand-navy mb-6">Practise with a network that cares.</h2>
        <p className="font-body text-xl text-brand-navy/70 mb-10">Join licensed professionals across East Africa and beyond.</p>
        <Link to="/therapist-signup">
          <Button size="lg" className="font-ui text-lg px-10 py-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Join the network <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </section>
  </div>
);

export default Therapists;
